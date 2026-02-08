"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type CheckoutData = {
  id: string;
  status: string;
  line_items?: Array<{ item: { title?: string; price?: number }; quantity: number }>;
  totals?: Array<{ type: string; amount: number }>;
  currency?: string;
  order?: { id: string };
  messages?: Array<{ type: string; content: string }>;
};

const ALLOWED_DELEGATES = ["payment.instruments_change", "payment.credential"];

export default function CheckoutPage() {
  const params = useParams();
  const sessionId = Array.isArray(params.id) ? params.id[0] : params.id;
  const searchParams = useSearchParams();
  const [checkout, setCheckout] = useState<CheckoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pendingRequests = useRef(new Map<string, (value: any) => void>());
  const channelPort = useRef<MessagePort | null>(null);
  const readyRequestId = useRef<string | null>(null);

  const ecVersion = searchParams.get("ec_version");
  const requestedDelegates = useMemo(() => {
    const raw = searchParams.get("ec_delegate");
    if (!raw) return [];
    return raw.split(",").map((v) => v.trim()).filter(Boolean);
  }, [searchParams]);

  const acceptedDelegates = useMemo(
    () => requestedDelegates.filter((d) => ALLOWED_DELEGATES.includes(d)),
    [requestedDelegates]
  );

  const sendMessage = (payload: any) => {
    if (channelPort.current) {
      channelPort.current.postMessage(payload);
      return;
    }
    window.parent?.postMessage(payload, "*");
  };

  const sendRequest = (method: string, params?: Record<string, unknown>) => {
    const id = `${method}_${crypto.randomUUID()}`;
    const payload = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolve) => {
      pendingRequests.current.set(id, resolve);
      sendMessage(payload);
    });
  };

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (event.ports && event.ports[0] && readyRequestId.current && data.id === readyRequestId.current) {
        channelPort.current = event.ports[0];
        channelPort.current.onmessage = handler as any;
      }

      if (data.id && pendingRequests.current.has(data.id)) {
        const resolver = pendingRequests.current.get(data.id)!;
        pendingRequests.current.delete(data.id);
        resolver(data);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    if (!ecVersion) return;
    const id = `ready_${crypto.randomUUID()}`;
    readyRequestId.current = id;
    sendMessage({
      jsonrpc: "2.0",
      id,
      method: "ec.ready",
      params: { delegate: acceptedDelegates },
    });
  }, [ecVersion, acceptedDelegates]);

  useEffect(() => {
    if (!ecVersion || !sessionId) return;
    sendMessage({
      jsonrpc: "2.0",
      method: "ec.start",
      params: { id: sessionId },
    });
  }, [ecVersion, sessionId]);

  useEffect(() => {
    const fetchCheckout = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!sessionId) return;
        const res = await fetch(`/api/checkout/${sessionId}`, { cache: "no-store" });
        const data = await res.json();
        setCheckout(data as CheckoutData);
        setStatus(data?.status ?? null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    if (sessionId) fetchCheckout();
  }, [sessionId]);

  const requestPaymentCredential = async () => {
    if (!acceptedDelegates.includes("payment.credential")) return null;
    const response = (await sendRequest("ec.payment.credential_request", {
      checkout_id: sessionId,
    })) as any;
    return response?.result?.credential ?? response?.result ?? null;
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const credential = await requestPaymentCredential();
      const payment = credential
        ? {
            instruments: [
              {
                id: "instrument_1",
                handler_id: "com.demo.mock_payment",
                type: "card",
                selected: true,
                credential,
              },
            ],
          }
        : undefined;

      const res = await fetch(`/api/checkout/${sessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkout: { payment } }),
      });
      const data = (await res.json()) as CheckoutData;
      setCheckout(data);
      setStatus(data.status);

      sendMessage({
        jsonrpc: "2.0",
        method: "ec.complete",
        params: { id: sessionId, order: data.order },
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>Loading checkout...</div>;
  if (error) return <div style={{ padding: 40, textAlign: "center", color: "#b91c1c" }}>{error}</div>;

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Checkout</h1>
      <p style={{ color: "#666", marginBottom: 16 }}>Session: {sessionId}</p>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Items</h2>
        {checkout?.line_items?.map((li, idx) => (
          <div key={idx} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span>{li.item.title ?? "Item"}</span>
            <span>Qty {li.quantity}</span>
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          <strong>Status:</strong> {status}
        </div>
      </div>

      <button
        onClick={handleComplete}
        disabled={isSubmitting}
        style={{
          width: "100%",
          padding: "12px 16px",
          background: "#111827",
          color: "white",
          borderRadius: 8,
          border: "none",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {isSubmitting ? "Processing..." : "Pay and Complete"}
      </button>
    </div>
  );
}
