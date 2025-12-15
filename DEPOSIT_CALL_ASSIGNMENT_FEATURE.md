# Deposit Call Assignment Feature

## Overview

This feature allows Affiliate Managers and Admins to assign deposit calls to agents directly from the Assigned Leads table when creating or viewing orders.

## Implementation Details

### Backend Changes

#### 1. New Controller Method (`backend/controllers/depositCalls.js`)

- **Method**: `createAndAssignToAgent`
- **Route**: `POST /deposit-calls/assign-to-agent`
- **Functionality**:
  - Creates a new deposit call for a single FTD lead OR updates an existing deposit call
  - Assigns the deposit call to a specified agent
  - Only accessible by admins and affiliate managers
  - Validates that the lead is an FTD type
  - Validates that the agent has the 'agent' role
  - Returns whether it's a new deposit call or a reassignment

#### 2. Route Addition (`backend/routes/depositCalls.js`)

- Added route: `POST /deposit-calls/assign-to-agent`
- Protected by authentication middleware

### Frontend Changes

#### 1. New Component (`frontend/src/components/AssignDepositCallDialog.jsx`)

- **Purpose**: Dialog for selecting an agent to assign the deposit call to
- **Features**:
  - Displays FTD lead details (name, email, phone)
  - Fetches and displays list of available agents
  - Agent selection dropdown with agent name and email
  - Loading states and error handling
  - Success/failure notifications

#### 2. Service Method (`frontend/src/services/depositCallsService.js`)

- **Method**: `assignToAgent(orderId, leadId, agentId)`
- **Purpose**: Calls the backend API to create and assign deposit call to agent

#### 3. OrdersPage Updates (`frontend/src/pages/OrdersPage.jsx`)

- **New Icon Import**: `PhoneInTalk as PhoneIcon`
- **New Dialog Import**: `AssignDepositCallDialog`
- **New Service Import**: `depositCallsService`
- **New State**: `assignDepositCallDialog` for managing dialog state
- **New Handlers**:
  - `handleOpenAssignDepositCallDialog(order, lead)` - Opens the dialog
  - `handleCloseAssignDepositCallDialog()` - Closes the dialog
  - `handleAssignDepositCall(orderId, leadId, agentId)` - Handles the assignment
- **UI Changes**:
  - Added phone icon button in the Assigned Leads table Status column
  - Button appears for all FTD leads (orderedAs='ftd' or leadType='ftd')
  - Only visible to admins and affiliate managers
  - Button has a phone icon with tooltip "Assign deposit call to agent"
  - Located in the Status column alongside other action buttons

## User Flow

1. **Admin or Affiliate Manager** creates or views an order
2. Expands order details to see the Assigned Leads table
3. For each FTD lead, they see a phone icon button (📞) in the Status column
4. Clicking the phone icon opens the "Assign Deposit Call to Agent" dialog
5. Dialog shows:
   - FTD lead details (name, email, phone)
   - Dropdown to select an agent
   - Information text explaining what will happen
6. User selects an agent from the dropdown
7. User clicks "Assign" button
8. System creates or updates the deposit call and assigns it to the selected agent
9. Success notification appears
10. Agent can now see and manage this deposit call in the Deposit Calls page

## Access Control

### Backend

- Only `admin` and `affiliate_manager` roles can create and assign deposit calls
- Agents can only view deposit calls assigned to them (existing functionality)

### Frontend

- Phone icon button only visible to users with `admin` or `affiliate_manager` roles
- Only appears for FTD leads (not cold leads or other types)

## Database Changes

No schema changes were required. The existing `DepositCall` model already supports:

- `assignedAgent` field for agent assignment
- `leadId` and `orderId` references
- All necessary fields for deposit call management

## Integration with Existing Features

### Deposit Calls Page

- Agents assigned via this feature will see the deposit call in their Deposit Calls page
- They can schedule, manage, and mark calls as done
- Account Managers can approve completed calls
- Full integration with existing calendar and call tracking features

### Lead Assignment

- This feature is separate from but complementary to the existing lead assignment feature
- Lead can be assigned to an agent (for general handling)
- Deposit call can be assigned to an agent (for follow-up calls)
- Both can be the same or different agents

## Testing Checklist

- [ ] Admin can assign deposit call to agent for FTD leads
- [ ] Affiliate Manager can assign deposit call to agent for FTD leads
- [ ] Phone icon button appears in Status column for FTD leads
- [ ] Phone icon button does NOT appear for non-FTD leads
- [ ] Phone icon button only visible to admins and affiliate managers
- [ ] Dialog opens correctly with lead details
- [ ] Agent dropdown populates with available agents
- [ ] Creating new deposit call works correctly
- [ ] Reassigning existing deposit call works correctly
- [ ] Success notifications appear
- [ ] Error handling works (invalid agent, invalid lead, etc.)
- [ ] Agent can see assigned deposit call in Deposit Calls page
- [ ] Order list refreshes after assignment
- [ ] Expanded order details refresh after assignment

## Notes

- The button appears in the Status column alongside other action buttons (Cancel, Change FTD, Convert, Assign to Agent)
- The feature works for both newly created orders and existing orders with FTD leads
- Deposit calls can be reassigned to different agents by clicking the button again
- The system automatically determines the Account Manager based on the order requester
