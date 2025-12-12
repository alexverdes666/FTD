# FTD to Filler Conversion Script

This script converts all your existing FTD (First Time Deposit) leads into filler leads, preserving all their data including documents, contact information, history, and more.

## Purpose

Use this script when you want to populate your application with realistic filler data based on your actual FTD leads. The filler leads will have all the same data as your FTDs (names, phones, documents, etc.) but will be marked as `leadType: 'filler'`.

## Features

- ✅ Preserves ALL lead data (personal info, documents, history, sessions, etc.)
- ✅ Handles unique email constraint by prefixing with timestamps
- ✅ Keeps phone numbers intact
- ✅ Resets assignment fields (leads become unassigned)
- ✅ Dry-run mode to preview changes before executing
- ✅ Supports limiting the number of conversions
- ✅ Detailed logging and error reporting

## Usage

### 1. Dry Run (Preview Only)

First, run without the `--execute` flag to see what will happen:

```bash
cd backend/scripts
node convert-ftds-to-fillers.js
```

This will show you:
- How many FTD leads will be converted
- Current database statistics
- Preview of the first few leads that would be created
- No actual changes to the database

### 2. Execute the Conversion

Once you're ready, run with the `--execute` flag:

```bash
node convert-ftds-to-fillers.js --execute
```

### 3. Limit the Conversion

To convert only a specific number of leads (useful for testing):

```bash
node convert-ftds-to-fillers.js --execute --limit=10
```

This will convert only the first 10 FTD leads.

## What Gets Converted

### ✅ Data Preserved (Copied to Filler)
- Personal Information: firstName, lastName, prefix
- Contact Info: newPhone, oldPhone (emails are modified)
- Demographics: country, gender, dob
- Documents: All documents and their statuses
- Address & SIN
- Social Media links
- Campaign, Client Broker, Client Network, Our Network
- All history arrays (clientBrokerHistory, clientNetworkHistory, etc.)
- Fingerprint and device type
- Proxy assignments
- Browser sessions and session history
- Call numbers and call history
- Comments

### 🔄 Data Modified
- `leadType`: Changed from "ftd" to "filler"
- `newEmail`: Prefixed with `filler.{timestamp}.{index}.` to ensure uniqueness
- `_id`: New ObjectId generated
- `createdAt` & `updatedAt`: Set to current date/time

### 🚫 Data Reset
- `isAssigned`: Set to false
- `assignedTo`: Set to null
- `assignedAt`: Set to null

## Example Output

```
==============================================================
🚀 FTD to Filler Conversion Script
==============================================================

🔌 Connecting to MongoDB...
✅ Connected to MongoDB successfully

📊 CURRENT DATABASE STATE:
   FTD leads: 250
   Filler leads: 45

📥 Fetching FTD leads...
✅ Found 250 FTD leads to convert

🔄 Starting conversion process...

✅ [1/250] Created filler from FTD:
   John Doe | USA | +1234567890
✅ [2/250] Created filler from FTD:
   Jane Smith | Canada | +1987654321
...

======================================================================
📊 CONVERSION SUMMARY
======================================================================
✅ Successfully created: 250 filler leads
⏭️  Skipped (duplicates): 0 leads
❌ Errors: 0 leads
📈 Total FTD leads processed: 250
======================================================================

📊 FINAL DATABASE STATE:
   FTD leads: 250
   Filler leads: 295 (was 45, added 250)

👋 Disconnected from MongoDB
✅ Script completed successfully!
```

## Email Transformation

Since `newEmail` has a unique constraint in the database, the script makes a minimal transformation to keep emails looking natural:

```
Original FTD email:  john.doe@example.com
Filler email:        john.doe+filler0@example.com
```

The format uses Gmail-style `+` addressing: `{localpart}+filler{index}@{domain}`

**Examples:**
- `john@example.com` → `john+filler0@example.com`
- `jane.smith@gmail.com` → `jane.smith+filler1@gmail.com`
- `contact@business.co.uk` → `contact+filler2@business.co.uk`

This ensures:
- ✅ No conflicts with existing FTD emails
- ✅ No conflicts between multiple filler conversions
- ✅ Each filler has a unique email
- ✅ Emails look natural and realistic

## Requirements

- Node.js installed
- Backend `.env` file with valid `MONGODB_URI`
- Existing FTD leads in the database

## Troubleshooting

### "MONGODB_URI not found"
Make sure you have a `.env` file in the `backend` directory with your MongoDB connection string.

### "No FTD leads found"
Check that you have leads with `leadType: 'ftd'` in your database.

### Duplicate Email Errors
This shouldn't happen due to the timestamp-based email generation, but if it does, try running the script again (the timestamp will be different).

## Safety

- ✅ **Non-destructive**: Original FTD leads are never modified or deleted
- ✅ **Dry-run first**: Always shows preview before making changes
- ✅ **Reversible**: You can delete filler leads by running a MongoDB query if needed

To remove all filler leads created by this script:
```javascript
// In MongoDB shell or script
db.leads.deleteMany({ 
  leadType: 'filler', 
  newEmail: { $regex: /\+filler\d+@/ } 
})
```

## Notes

- The script processes leads sequentially to avoid overwhelming the database
- Large datasets may take several minutes to process
- All FTD leads remain unchanged in the database
- Filler leads can be used immediately in your application

