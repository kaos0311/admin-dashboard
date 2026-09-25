# Tera Barcode Scanner Setup Guide

## Overview

This guide walks through connecting and configuring Tera barcode scanners for use with the Advanced Home Medical Admin Dashboard barcode scanning page.

The scanners operate in **USB HID keyboard mode** — they appear to Windows as a standard keyboard and type scanned barcodes into whichever input has focus. Some models append an `Enter` key after each scan by default.

## Prerequisites

- Tera barcode scanner with USB cable or USB receiver
- Windows 10/11 workstation
- Access to the dashboard at `/inventory/scanner`
- A known inventory item with a barcode for testing

## 1. Physical Connection

### Wired Scanner (USB Cable)

1. Plug the USB cable into an available USB port on the workstation.
2. Wait for Windows to install the driver automatically (typically 10–15 seconds).
3. Confirm the device appears under "Keyboard" devices in Device Manager.

### Wireless Scanner (USB Receiver)

1. Insert the USB receiver into an available USB port.
2. Insert batteries into the scanner if required.
3. Press the pairing button on the receiver, then press the pairing button on the scanner.
4. Wait for the connection LED to turn solid green.

## 2. Windows Recognition Test

Before testing with the dashboard, verify Windows detects the scanner correctly:

1. Open **Notepad** (or any text editor).
2. Point the scanner at a barcode and press the trigger.
3. **Confirm the full barcode appears** in Notepad.
4. **Confirm leading zeroes are preserved** — a barcode like `00641416753115` must appear exactly as `00641416753115`, not `641416753115`.
5. **Confirm Enter/CR is sent after the scan** — the cursor should move to the next line after each scan.

### If Leading Zeroes Are Stripped

Leading zeroes are critical for correct inventory lookups. If your scanner strips them:

- Check whether the scanner has a "Convert to EAN-13" or "UPC-A to EAN-13" setting enabled and disable it.
- Reset the scanner to factory defaults.
- **Important**: Never convert barcodes to numeric types. Use the scanner manual for your exact Tera model number.

### If Enter Is Not Sent

Some scanners require configuration to append an Enter (CR) suffix:

1. Consult your Tera scanner model's manual for the configuration barcode that enables "Enter suffix" or "CR suffix."
2. **Do not use configuration barcodes from a different Tera model** — they may program the scanner incorrectly.
3. Scan the configuration barcode from your manual.
4. Retest in Notepad — the cursor should advance to the next line after each scan.

### If Scanner Uses Wrong Keyboard Layout

- Tera scanners typically default to US English keyboard layout.
- If scanned characters don't match the barcode, the layout may be set incorrectly.
- Consult your model's manual for the "US Keyboard" or "Keyboard Layout" configuration barcode.

## 3. Dashboard Scanner Page Test

1. Open the dashboard in a modern browser (Chrome/Edge/Firefox).
2. Navigate to **Inventory → Barcode Scanner** (`/inventory/scanner`).
3. **Confirm the scanner input is focused** — the barcode input should have a blinking cursor.
4. Point the scanner at a **known inventory item** barcode and press the trigger.
5. **Confirm the correct product appears** in the lookup result card.
6. Verify the displayed fields match the inventory record:
   - Product name
   - SKU
   - Category
   - Current quantity
   - Location
   - Status

## 4. Unknown Barcode Handling

1. Scan a barcode that does **not** exist in the inventory.
2. **Confirm the "Unknown Barcode" state appears**.
3. **Confirm no inventory changes were made** — the transaction history will show a `not_found` record.

## 5. Transaction Test (Receive)

1. Set the transaction type to **Receive Inventory**.
2. Scan a known barcode.
3. Confirm the product card appears with a **Confirmation form**.
4. Enter a quantity (e.g., 1).
5. Click **Confirm Receive Inventory**.
6. Confirm the success message appears with Before/Change/After quantities.
7. **Verify Firestore documents**:
   - `inventory/{itemId}`: `quantityOnHand` increased by the specified amount.
   - `inventoryTransactions/{transactionId}`: immutable record of the transaction.

## 6. Transaction Test (Issue)

1. Set the transaction type to **Remove / Issue Inventory**.
2. Scan a barcode with sufficient stock.
3. Confirm the product card and confirmation form appear.
4. Click **Confirm**.
5. Confirm the quantity decreased correctly.

### Insufficient Quantity Test

1. Scan a barcode with zero or insufficient available stock.
2. Confirm the Cloud Function returns a `failed-precondition` error.
3. Confirm the UI shows a failure message. No inventory change occurs.

## 7. Multi-Workstation Testing

1. Set up two workstations, each with a Tera scanner.
2. Open the dashboard scanner page on both.
3. Scan the same barcode on both workstations.
4. Confirm each scan creates an independent transaction record.

## 8. Troubleshooting

### Scanner types characters but not the full barcode

- Check if the buffer timeout is too short. The hook uses a 150ms timeout by default.
- Some older scanners emit characters more slowly. The hook will flush after the timeout.

### Scanner input not focused

- Click the scanner input field manually.
- The page auto-focuses the input 500ms after load.

### No match but barcode is correct

- Verify the barcode exists in the `inventory` collection under the `barcode`, `sku`, `serial`, or `lotNumber` field.
- Run a manual lookup via the dashboard Inventory page to confirm the item exists.

### Duplicate scan warning

- The system suppresses duplicate scans within 2 seconds by default.
- If performing multiple transactions on the same barcode, wait 2+ seconds between scans.

### Cloud Function errors

- Check the Firebase Functions logs for detailed error messages.
- Common issues: missing `isDeleted` index, permission denied, or Firestore transaction conflicts.

## 9. Important Safeguards

- **No automatic destructive transactions**: Every mutation requires explicit user confirmation.
- **No client-side inventory changes**: All mutations go through authenticated Cloud Functions.
- **Leading zeroes preserved**: Barcodes are never converted to JavaScript numbers.
- **Audit trail**: Every scan creates an immutable `inventoryTransactions` record.
- **Scanner source recorded**: Transactions include `source: "tera_hid_scanner"` for tracking.
