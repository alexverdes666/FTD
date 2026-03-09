const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect('mongodb+srv://alexverdes666:3A0BQeGpi7dP5Yf8@cluster0.1w8ozov.mongodb.net/test_local?appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const db = mongoose.connection.db;

  // Find the lead
  const lead = await db.collection('leads').findOne({ newEmail: 'anisamimon8@gmail.com' });
  console.log('=== LEAD ===');
  console.log('ID:', lead._id.toString());
  console.log('Name:', lead.firstName, lead.lastName);
  console.log('Agent:', lead.assignedAgent?.toString());

  if (lead.assignedAgent) {
    const agent = await db.collection('users').findOne({ _id: lead.assignedAgent });
    console.log('Agent name:', agent?.fullName);
  }

  // Find the AM
  const am = await db.collection('users').findOne({ email: 'alisvedres1718@gmail.com' });
  console.log('\n=== AFFILIATE MANAGER ===');
  console.log('ID:', am?._id.toString());
  console.log('Name:', am?.fullName);

  // Find the order
  const order = await db.collection('orders').aggregate([
    { $addFields: { idStr: { $toString: '$_id' } } },
    { $match: { idStr: { $regex: '7876d330' } } },
    { $project: { idStr: 0 } }
  ]).toArray();

  if (order.length > 0) {
    const o = order[0];
    console.log('\n=== ORDER ===');
    console.log('ID:', o._id.toString());
    console.log('Status:', o.status);
    const lm = o.leadsMetadata?.find(m => m.leadId?.toString() === lead._id.toString());
    if (lm) {
      console.log('depositConfirmed:', lm.depositConfirmed);
      console.log('depositConfirmedBy:', lm.depositConfirmedBy?.toString());
      if (lm.depositConfirmedBy) {
        const confirmedBy = await db.collection('users').findOne({ _id: lm.depositConfirmedBy });
        console.log('Confirmed by:', confirmedBy?.fullName, confirmedBy?.email);
      }
    }
  }

  // Find the deposit call
  const dc = await db.collection('depositcalls').findOne({
    leadId: lead._id,
    orderId: order[0]?._id,
  });

  console.log('\n=== DEPOSIT CALL ===');
  console.log('ID:', dc?._id.toString());
  console.log('depositConfirmed:', dc?.depositConfirmed);
  console.log('depositStatus:', dc?.depositStatus);
  console.log('depositCallDeclaration:', dc?.depositCallDeclaration?.toString() || 'NONE');
  console.log('depositAdminCallDeclaration:', dc?.depositAdminCallDeclaration?.toString() || 'NONE');
  console.log('depositAdminCalls count:', dc?.depositAdminCalls?.length || 0);
  console.log('assignedAgent:', dc?.assignedAgent?.toString() || 'NONE');
  console.log('accountManager:', dc?.accountManager?.toString() || 'NONE');

  if (dc?.accountManager) {
    const dcAm = await db.collection('users').findOne({ _id: dc.accountManager });
    console.log('AM name:', dcAm?.fullName, dcAm?.email);
  }

  // Find ALL AgentCallDeclarations for this lead
  console.log('\n=== AGENT CALL DECLARATIONS FOR THIS LEAD ===');
  const decls = await db.collection('agentcalldeclarations').find({
    lead: lead._id,
  }).sort({ createdAt: -1 }).toArray();

  console.log('Total declarations:', decls.length);
  for (const d of decls) {
    const agentUser = await db.collection('users').findOne({ _id: d.agent });
    const amUser = await db.collection('users').findOne({ _id: d.affiliateManager });
    console.log(`\n  ID: ${d._id}`);
    console.log(`  cdrCallId: ${d.cdrCallId}`);
    console.log(`  callType: ${d.callType}, category: ${d.callCategory}`);
    console.log(`  status: ${d.status}, isActive: ${d.isActive}`);
    console.log(`  isAdminDeclared: ${d.isAdminDeclared || false}`);
    console.log(`  totalBonus: $${d.totalBonus}, baseBonus: $${d.baseBonus}, hourlyBonus: $${d.hourlyBonus}`);
    console.log(`  callDuration: ${d.callDuration}s (${Math.floor(d.callDuration/60)}m ${d.callDuration%60}s)`);
    console.log(`  agent: ${agentUser?.fullName || d.agent}`);
    console.log(`  affiliateManager: ${amUser?.fullName || d.affiliateManager} (${amUser?.email || ''})`);
    console.log(`  orderId: ${d.orderId}`);
    console.log(`  month/year: ${d.declarationMonth}/${d.declarationYear}`);
    console.log(`  createdAt: ${d.createdAt}`);
    console.log(`  reviewNotes: ${d.reviewNotes || ''}`);
  }

  // Check the AM expense table for this AM in the declaration's month
  // Find the deposit declaration specifically
  const depositDecl = decls.find(d =>
    d.callType === 'deposit' &&
    d.isActive === true &&
    d.status === 'approved' &&
    d.orderId?.toString() === order[0]?._id.toString()
  );

  if (depositDecl) {
    console.log('\n=== AM EXPENSE TABLE CHECK ===');
    const tableDate = new Date(depositDecl.declarationYear, depositDecl.declarationMonth - 1, 1);
    const amTable = await db.collection('affiliatemanagertables').findOne({
      affiliateManager: depositDecl.affiliateManager,
      tableType: 'monthly',
      'period.month': depositDecl.declarationMonth,
      'period.year': depositDecl.declarationYear,
    });

    if (amTable) {
      console.log('Table found for', depositDecl.declarationMonth + '/' + depositDecl.declarationYear);
      const depositRow = amTable.tableData?.find(r => r.id === 'deposit_calls');
      const talkingTimeRow = amTable.tableData?.find(r => r.id === 'total_talking_time');
      console.log('deposit_calls row:', JSON.stringify(depositRow));
      console.log('total_talking_time row:', JSON.stringify(talkingTimeRow));
    } else {
      console.log('No AM table found for', depositDecl.declarationMonth + '/' + depositDecl.declarationYear);
    }
  } else {
    console.log('\n=== No active approved deposit declaration found for this order ===');
  }

  await mongoose.disconnect();
}

check().catch(e => { console.error(e); process.exit(1); });
