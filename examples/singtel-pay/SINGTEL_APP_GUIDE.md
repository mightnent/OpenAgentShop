# Singtel Bill Payment App

A Next.js UCP (with MCP) binding app for Singtel bill payment, built with OpenAgentShop SDK.

## Features

- **Bill Lookup by Phone Number**: Agents can look up bills using phone numbers
- **UCP Checkout Flow**: Integrated Universal Commerce Protocol for payment processing
- **MCP UI with Monochrome Colors**: Clean, monochrome interface (#1a1a1a, #4a4a4a)
- **SQLite Database**: Local development database with bill records

## Running the App

```bash
npm run dev
```

The app runs on: **http://localhost:3003**

## Agent Flow Example

### Conversation Flow:

**User:** Hey, can I check what is the outstanding bill for Singtel?

**Agent:** Sure, can I have your phone number?

**User:** 81132253

**Agent:** (Uses MCP tool: `lookup_bill_by_phone` with phoneNumber: "81132253")
- Response: MCP UI bill card showing:
  - Mobile Bill - 81132253
  - Amount Due: S$85.00
  - Due Date: 2026-02-15
  - Plan Type: XO Plus 50GB
  - Data Usage: 38GB / 50GB
  - Billing Period: Jan 1 - Jan 31, 2026

**User:** (Clicks checkout button in the MCP UI)

**Agent:** (Initiates UCP checkout flow via `create_checkout` tool)
- Creates checkout session
- Returns continue_url for payment

## Available MCP Tools

### 1. `lookup_bill_by_phone`
Look up a bill by phone number (account number).

**Parameters:**
- `phoneNumber` (string): The phone number to look up (e.g., "81132253")

**Example:**
```json
{
  "phoneNumber": "81132253"
}
```

### 2. `list_products`
List and filter bill products.

**Parameters:**
- `tier`: "prepaid" | "postpaid"
- `category`: "Mobile Bill" | "Broadband Bill" | "TV Bill"
- `keyword`: Search keyword
- `activeOnly`: boolean (default: true)

### 3. `get_product`
Get detailed information about a specific bill.

**Parameters:**
- `productId`: number

### 4. UCP Checkout Tools
- `create_checkout`: Start a checkout session
- `update_checkout`: Update buyer information
- `complete_checkout`: Finalize the checkout
- `cancel_checkout`: Cancel a checkout session

## Endpoints

### MCP Server
- **URL:** http://localhost:3003/api/mcp
- **Protocol:** MCP Streamable HTTP
- **Transport:** POST/GET/DELETE/OPTIONS

### UCP Profile Discovery
- **URL:** http://localhost:3003/.well-known/ucp
- **Returns:** UCP capabilities, services, payment handlers

### Merchant API
- **Products:** http://localhost:3003/api/merchant/products
- **Orders:** http://localhost:3003/api/merchant/orders

### Checkout
- **Checkout Page:** http://localhost:3003/checkout/[id]
- **Complete:** http://localhost:3003/api/checkout/[id]/complete

## Sample Bills in Database

### Bill 1: 81132253
- **Plan:** Priority Plus ($55/month)
- **Amount:** S$55.00
- **Due Date:** 2026-02-15
- **Status:** Not Overdue
- **Data Usage:** Unlimited 5G+

### Bill 2: 91234567
- **Plan:** Priority Ultra ($80/month)
- **Amount:** S$80.00
- **Due Date:** 2026-02-10
- **Status:** ⚠️ OVERDUE
- **Data Usage:** Unlimited 5G+

### Bill 3: 88776655
- **Plan:** Enhanced Lite ($35/month)
- **Amount:** S$35.00
- **Due Date:** 2026-02-20
- **Status:** Not Overdue
- **Data Usage:** Unlimited 5G+

## MCP UI Design

All MCP UI elements use monochrome colors:
- **Primary Color:** #1a1a1a (black)
- **Secondary Color:** #4a4a4a (dark gray)
- **Background:** white
- **Accent:** Various shades of gray

## Tech Stack

- **Framework:** Next.js 16
- **Database:** SQLite (better-sqlite3)
- **ORM:** Drizzle ORM
- **Protocol:** MCP SDK v1.25.3
- **Styling:** Tailwind CSS
- **Currency:** SGD (Singapore Dollar)

## Development

### Database Commands
```bash
npm run db:push    # Push schema changes
npm run db:seed    # Seed sample data
npm run db:studio  # Open Drizzle Studio
```

### Environment Variables
```bash
DATABASE_URL=file:./data/singtel.db
NEXT_PUBLIC_BASE_URL=http://localhost:3003
UCP_STRICT=false
```

## Testing the MCP Server

You can test the MCP server by connecting Claude Desktop or any MCP client to:

```json
{
  "mcpServers": {
    "singtel-pay": {
      "url": "http://localhost:3003/api/mcp"
    }
  }
}
```

Then try:
1. Ask: "Can you check my Singtel bill for 81132253?"
2. Agent will use `lookup_bill_by_phone` tool
3. MCP UI will show the bill card
4. Click checkout to initiate UCP flow
