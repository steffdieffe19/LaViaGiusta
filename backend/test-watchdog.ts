import { connectDatabase, disconnectDatabase, prisma } from './src/config/database.js';
import { getRedisConnection } from './src/config/redis.js';
import { WatchdogService } from './src/modules/sessions/watchdog.service.js';

const BASE_URL = 'http://localhost:3000/api/v1';

// Helper to delay execution
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  console.log('🧪 Starting Watchdog Core Integration Test...');
  
  // Connect to DB/Redis locally to allow manual manipulation of jobs
  await connectDatabase();
  const redis = getRedisConnection();

  try {
    // 1. Authenticate test user
    console.log('\n🔑 1. Logging in as test user...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'escursionista@test.it',
        password: 'test1234',
      }),
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
    }

    const loginData = await loginRes.json() as any;
    const token = loginData.data.tokens.accessToken;
    console.log('   ✅ Logged in successfully. Token received.');

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    // 2. Fetch Trails and select T01
    console.log('\n🏔️  2. Fetching available trails...');
    const trailsRes = await fetch(`${BASE_URL}/trails`, { headers });
    if (!trailsRes.ok) {
      throw new Error(`Failed to fetch trails: ${await trailsRes.text()}`);
    }
    const trailsData = await trailsRes.json() as any;
    const trailT01 = trailsData.data.find((t: any) => t.code === 'T01');
    if (!trailT01) {
      throw new Error('Trail T01 not found. Did you seed the database?');
    }
    console.log(`   ✅ Selected trail T01: "${trailT01.name}" (ID: ${trailT01.id})`);

    // 3. Clear existing active session if any
    console.log('\n🧹 3. Checking for active sessions...');
    const activeRes = await fetch(`${BASE_URL}/sessions/active`, { headers });
    if (!activeRes.ok) {
      throw new Error(`Failed to check active session: ${await activeRes.text()}`);
    }
    const activeData = await activeRes.json() as any;
    if (activeData.data) {
      const activeSessionId = activeData.data.id;
      console.log(`   ⚠️ Found active session ${activeSessionId}. Completing it to start fresh...`);
      const completeRes = await fetch(`${BASE_URL}/sessions/${activeSessionId}/complete`, {
        method: 'POST',
        headers,
      });
      if (completeRes.ok) {
        console.log('   ✅ Completed previous active session.');
      } else {
        console.log(`   ⚠️ Could not complete session: ${await completeRes.text()}. Trying raw DB complete...`);
        await prisma.hikingSession.update({
          where: { id: activeSessionId },
          data: { status: 'completed', completedAt: new Date() },
        });
      }
    } else {
      console.log('   ✅ No active sessions found.');
    }

    // 4. Perform check-in
    console.log('\n🥾 4. Performing check-in at trailhead...');
    const checkinRes = await fetch(`${BASE_URL}/sessions/check-in`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ trailId: trailT01.id }),
    });
    if (!checkinRes.ok) {
      throw new Error(`Check-in failed: ${await checkinRes.text()}`);
    }
    const checkinData = await checkinRes.json() as any;
    const sessionId = checkinData.data.sessionId;
    console.log(`   ✅ Checked in! Session ID: ${sessionId}`);
    console.log(`   ⏰ Expected end at: ${checkinData.data.expectedEndAt}`);

    // Verify status in DB is checked_in
    let session = await prisma.hikingSession.findUnique({ where: { id: sessionId } });
    console.log(`   📊 Status in Database: "${session?.status}"`);

    // 5. Start the hike
    console.log('\n🏃 5. Starting the hike...');
    const startRes = await fetch(`${BASE_URL}/sessions/${sessionId}/start`, {
      method: 'POST',
      headers,
    });
    if (!startRes.ok) {
      throw new Error(`Start hike failed: ${await startRes.text()}`);
    }
    const startData = await startRes.json() as any;
    console.log(`   ✅ Hike started. Current status: "${startData.data.status}"`);

    // 6. Record Location GPS updates
    console.log('\n📍 6. Sending location update...');
    // Coordinate close to trail T01 starting point (13.4980, 42.7400)
    const locationRes = await fetch(`${BASE_URL}/sessions/${sessionId}/location`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        latitude: 42.7405,
        longitude: 13.4982,
        altitude: 610,
        accuracy: 5,
        speed: 1.2,
        heading: 90,
        batteryLevel: 95,
        timestamp: new Date().toISOString(),
      }),
    });
    if (!locationRes.ok) {
      throw new Error(`Location update failed: ${await locationRes.text()}`);
    }
    const locationData = await locationRes.json() as any;
    console.log(`   ✅ Location saved. Out of bounds: ${locationData.data.isOutOfBounds}, Distance to path: ${locationData.data.distanceToPathMeters}m`);

    // 7. Fast-forward Watchdog Alert
    console.log('\n⏱️  7. Fast-forwarding watchdog timer expiration...');
    // We schedule the watchdog alert timeout with 100ms delay to force immediate execution
    await WatchdogService.scheduleWatchdogAlert(sessionId, 100);
    console.log('   ⏱️ Alert timeout scheduled for 100ms. Waiting for worker to process...');
    await sleep(2000); // Wait 2s for worker to run

    session = await prisma.hikingSession.findUnique({ where: { id: sessionId } });
    console.log(`   📊 Status after watchdog expiration: "${session?.status}"`);
    if (session?.status !== 'watchdog_alert') {
      throw new Error(`Expected session status to be "watchdog_alert", but got "${session?.status}"`);
    }
    console.log('   ✅ Watchdog alert successfully triggered!');

    // 8. Respond to alert (Extend / Sto bene)
    console.log('\n📱 8. Responding "OK" (extend timer) to prompt...');
    const respondRes = await fetch(`${BASE_URL}/sessions/${sessionId}/respond-alert`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ response: 'ok' }),
    });
    if (!respondRes.ok) {
      throw new Error(`Respond alert failed: ${await respondRes.text()}`);
    }
    const respondData = await respondRes.json() as any;
    console.log(`   ✅ Responded to alert. Status returned to: "${respondData.data.status}"`);
    console.log(`   ⏰ New expected end: ${respondData.data.expectedEndAt}`);

    // 9. Test Manual SOS
    console.log('\n🆘 9. Triggering manual SOS...');
    const sosRes = await fetch(`${BASE_URL}/sessions/${sessionId}/sos`, {
      method: 'POST',
      headers,
    });
    if (!sosRes.ok) {
      throw new Error(`Manual SOS failed: ${await sosRes.text()}`);
    }
    const sosData = await sosRes.json() as any;
    console.log(`   ✅ SOS Triggered. Status: "${sosData.data.status}"`);

    // Verify Emergency Event was logged
    const emergencyEvent = await prisma.emergencyEvent.findFirst({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
    if (!emergencyEvent) {
      throw new Error('EmergencyEvent was not logged in the database.');
    }
    console.log('   ✅ Emergency event logged in database successfully.');
    console.log(`      ID: ${emergencyEvent.id}`);
    console.log(`      Event Type: ${emergencyEvent.eventType}`);
    console.log(`      SMS Sent To: ${JSON.stringify(emergencyEvent.smsSentTo)}`);
    console.log(`      Call Initiated: ${emergencyEvent.callInitiated}`);

    // 10. Clean up by completing the session
    console.log('\n🏁 10. Completing/checking out of the session...');
    const completeRes = await fetch(`${BASE_URL}/sessions/${sessionId}/complete`, {
      method: 'POST',
      headers,
    });
    if (!completeRes.ok) {
      throw new Error(`Hike completion failed: ${await completeRes.text()}`);
    }
    const completeData = await completeRes.json() as any;
    console.log(`   ✅ Session completed! Status: "${completeData.data.session.status}"`);
    console.log(`   📊 Summary: Duration: ${completeData.data.durationMinutes}m, Distance: ${completeData.data.distanceKm}km, Avg Speed: ${completeData.data.avgSpeedKmh}km/h`);
    console.log(`   🎫 Digital Stamp Earned: ${completeData.data.stampEarned}`);

    console.log('\n🎉 ALL WATCHDOG CORE INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉\n');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
  } finally {
    // Disconnect from database and redis
    await disconnectDatabase();
    if (redis) {
      await redis.quit();
    }
  }
}

run();
