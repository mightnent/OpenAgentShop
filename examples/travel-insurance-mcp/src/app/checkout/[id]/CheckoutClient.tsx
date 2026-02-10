"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface CheckoutClientProps {
  initialCheckout: CheckoutData;
  ecVersion?: string;
  ecDelegate?: string;
  allowedDelegates: string[];
}

interface CheckoutData {
  id: string;
  status: string;
  buyer?: {
    email?: string;
    first_name?: string;
    last_name?: string;
  };
  line_items: Array<{
    id: string;
    item: { id: string; title?: string; price?: number };
    quantity: number;
    totals: Array<{ type: string; amount: number; display_text?: string }>;
  }>;
  currency: string;
  totals: Array<{ type: string; amount: number; display_text?: string }>;
  messages: Array<{
    type: string;
    code: string;
    content: string;
    severity?: string;
  }>;
  payment?: {
    instruments?: Array<Record<string, unknown>>;
  };
  continue_url?: string;
  order?: { id: string; permalink_url?: string };
}

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string;
  result?: Record<string, unknown>;
  error?: { code: string; message: string };
};

export function CheckoutClient({
  initialCheckout,
  ecVersion,
  ecDelegate,
  allowedDelegates,
}: CheckoutClientProps) {
  const [checkout, setCheckout] = useState<CheckoutData>(initialCheckout);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [ecActive, setEcActive] = useState(false);
  const pending = useRef(new Map<string, { resolve: (r: JsonRpcResponse) => void; reject: (e: unknown) => void }>());
  const portRef = useRef<MessagePort | null>(null);
  const startedRef = useRef(false);

  const acceptedDelegates = useMemo(() => {
    const requested = (ecDelegate || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (requested.length === 0) return [];
    return requested.filter((d) => allowedDelegates.includes(d));
  }, [ecDelegate, allowedDelegates]);

  const targetOrigin = useMemo(() => {
    try {
      if (document.referrer) return new URL(document.referrer).origin;
    } catch {
      return "*";
    }
    return "*";
  }, []);

  const sendMessage = useCallback(
    (message: JsonRpcRequest | JsonRpcResponse) => {
      if (portRef.current) {
        portRef.current.postMessage(message);
      } else {
        window.parent.postMessage(message, targetOrigin);
      }
    },
    [targetOrigin]
  );

  const sendRequest = useCallback(
    (method: string, params?: Record<string, unknown>) => {
      const id = `${method}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const message: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };
      return new Promise<JsonRpcResponse>((resolve, reject) => {
        pending.current.set(id, { resolve, reject });
        sendMessage(message);
      });
    },
    [sendMessage]
  );

  const handleRpcMessage = useCallback(
    (raw: unknown, ports?: readonly MessagePort[]) => {
      const msg = raw as JsonRpcResponse;
      if (!msg || typeof msg !== "object" || (msg as any).jsonrpc !== "2.0") return;

      if (ports && ports.length > 0 && !portRef.current) {
        portRef.current = ports[0];
        portRef.current.onmessage = (event) => handleRpcMessage(event.data);
      }

      if (msg.id && pending.current.has(msg.id)) {
        const entry = pending.current.get(msg.id)!;
        pending.current.delete(msg.id);
        entry.resolve(msg);
      }
    },
    []
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      handleRpcMessage(event.data, event.ports);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [handleRpcMessage]);

  useEffect(() => {
    if (!ecVersion || startedRef.current) return;
    let mounted = true;
    const run = async () => {
      const readyResp = await sendRequest("ec.ready", { delegate: acceptedDelegates });
      if (!mounted) return;
      if (readyResp.result?.checkout && typeof readyResp.result.checkout === "object") {
        setCheckout((prev) => ({ ...prev, ...(readyResp.result!.checkout as CheckoutData) }));
      }
      setEcActive(true);
      sendMessage({
        jsonrpc: "2.0",
        method: "ec.start",
        params: { checkout: initialCheckout },
      });
      startedRef.current = true;
    };
    run().catch(() => {
      // Ignore handshake errors in non-embedded contexts
    });
    return () => {
      mounted = false;
    };
  }, [ecVersion, acceptedDelegates, sendRequest, sendMessage, initialCheckout]);

  const updateCheckout = async (payload: Record<string, unknown>) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/checkout/${checkout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok) {
        setCheckout(data);
        if (ecActive) {
          sendMessage({ jsonrpc: "2.0", method: "ec.buyer.change", params: { checkout: data } });
          sendMessage({ jsonrpc: "2.0", method: "ec.messages.change", params: { checkout: data } });
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleBuyerSave = async () => {
    await updateCheckout({ buyer: checkout.buyer });
  };

  const handlePaymentChange = async () => {
    if (!ecActive) return;
    const resp = await sendRequest("ec.payment.instruments_change_request", { checkout });
    if (resp.result?.checkout) {
      const updated = { ...checkout, ...(resp.result.checkout as CheckoutData) };
      setCheckout(updated);
      sendMessage({ jsonrpc: "2.0", method: "ec.payment.change", params: { checkout: updated } });
    }
  };

  const handlePaymentCredential = async () => {
    if (!ecActive) return;
    setIsCompleting(true);
    try {
      const resp = await sendRequest("ec.payment.credential_request", { checkout });
      if (resp.result?.checkout) {
        const updated = { ...checkout, ...(resp.result.checkout as CheckoutData) };
        setCheckout(updated);
        sendMessage({ jsonrpc: "2.0", method: "ec.payment.change", params: { checkout: updated } });

        const completion = await fetch(`/api/checkout/${checkout.id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payment: updated.payment,
            idempotencyKey: crypto.randomUUID(),
          }),
        });
        const completionData = await completion.json();
        if (completion.ok) {
          setCheckout(completionData);
          sendMessage({ jsonrpc: "2.0", method: "ec.complete", params: { checkout: completionData } });
        }
      }
    } finally {
      setIsCompleting(false);
    }
  };

  const handleLocalComplete = async () => {
    setIsCompleting(true);
    try {
      const mockPayment = checkout.payment || {
        instruments: [
          {
            id: `instr_${checkout.id}`,
            handler_id: "mock_handler_1",
            type: "token",
            selected: true,
            credential: { type: "mock_token", token: "tok_demo" },
          },
        ],
      };
      const response = await fetch(`/api/checkout/${checkout.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment: mockPayment,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setCheckout(data);
        if (ecActive) {
          sendMessage({ jsonrpc: "2.0", method: "ec.complete", params: { checkout: data } });
        }
      }
    } finally {
      setIsCompleting(false);
    }
  };

  const selectedInstrument = checkout.payment?.instruments?.find((i: any) => i.selected);

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Checkout</h1>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
              {checkout.status.replace(/_/g, " ")}
            </span>
          </div>

          <div className="text-sm text-gray-500 mb-6">
            Session ID: <code className="bg-gray-100 px-2 py-0.5 rounded">{checkout.id}</code>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-sm font-medium text-gray-700 mb-2">Buyer Information</h2>
            <div className="grid grid-cols-1 gap-3">
              <input
                className="border rounded px-3 py-2 text-sm"
                placeholder="First name"
                value={checkout.buyer?.first_name || ""}
                onChange={(e) =>
                  setCheckout((prev) => ({
                    ...prev,
                    buyer: { ...prev.buyer, first_name: e.target.value },
                  }))
                }
              />
              <input
                className="border rounded px-3 py-2 text-sm"
                placeholder="Last name"
                value={checkout.buyer?.last_name || ""}
                onChange={(e) =>
                  setCheckout((prev) => ({
                    ...prev,
                    buyer: { ...prev.buyer, last_name: e.target.value },
                  }))
                }
              />
              <input
                className="border rounded px-3 py-2 text-sm"
                placeholder="Email"
                value={checkout.buyer?.email || ""}
                onChange={(e) =>
                  setCheckout((prev) => ({
                    ...prev,
                    buyer: { ...prev.buyer, email: e.target.value },
                  }))
                }
              />
              <button
                className="bg-gray-900 text-white rounded px-4 py-2 text-sm"
                onClick={handleBuyerSave}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Buyer Info"}
              </button>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Items</h2>
            <div className="space-y-3">
              {checkout.line_items.map((item) => {
                const itemTotal = item.totals.find((t) => t.type === "total");
                return (
                  <div
                    key={item.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {item.item.title || `Product #${item.item.id}`}
                      </p>
                      <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-medium text-gray-900">
                      {itemTotal ? (itemTotal.amount / 100).toFixed(2) : "-"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t pt-4 mb-6">
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Total</span>
              <span>
                {(checkout.totals.find((t) => t.type === "total")?.amount || 0) / 100}
              </span>
            </div>
          </div>

          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800">Payment</p>
                <p className="text-xs text-blue-700">
                  {selectedInstrument ? "Payment method selected" : "No payment method yet"}
                </p>
              </div>
              {acceptedDelegates.includes("payment.instruments_change") && ecActive && (
                <button
                  className="text-sm text-blue-700 underline"
                  onClick={handlePaymentChange}
                >
                  Change
                </button>
              )}
            </div>
          </div>

          {checkout.status === "ready_for_complete" && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-green-700 text-sm mb-3">
                Ready to complete checkout.
              </p>
              {acceptedDelegates.includes("payment.credential") && ecActive ? (
                <button
                  className="bg-green-700 text-white rounded px-4 py-2 text-sm"
                  onClick={handlePaymentCredential}
                  disabled={isCompleting}
                >
                  {isCompleting ? "Waiting for payment..." : "Pay Now"}
                </button>
              ) : (
                <button
                  className="bg-green-700 text-white rounded px-4 py-2 text-sm"
                  onClick={handleLocalComplete}
                  disabled={isCompleting}
                >
                  {isCompleting ? "Completing..." : "Complete Checkout"}
                </button>
              )}
            </div>
          )}

          {checkout.status === "completed" && checkout.order && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h2 className="text-sm font-medium text-green-800 mb-2">Order Confirmed!</h2>
              <p className="text-green-700">
                Order ID: <code className="bg-green-100 px-2 py-0.5 rounded">{checkout.order.id}</code>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
