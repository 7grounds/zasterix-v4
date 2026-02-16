#!/usr/bin/env node

/**
 * Test script for project initialization
 * This simulates what happens when a user types "session about [topic]"
 */

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000/api/projects/init';

async function testProjectInit(projectName) {
  console.log('='.repeat(60));
  console.log('Testing Project Initialization');
  console.log('='.repeat(60));
  console.log(`Project Name: ${projectName}`);
  console.log('');

  try {
    console.log('Calling API endpoint...');
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
      }),
    });

    const data = await response.json();
    
    console.log(`Response Status: ${response.status}`);
    console.log('Response Data:', JSON.stringify(data, null, 2));
    console.log('');

    if (data.status === 'success') {
      console.log('✓ SUCCESS: Project initialized!');
      console.log('');
      console.log('Project Details:');
      console.log(`  UUID: ${data.project.id}`);
      console.log(`  Name: ${data.project.name}`);
      console.log(`  Type: ${data.project.type}`);
      console.log(`  Status: ${data.project.status}`);
      console.log(`  Created: ${data.project.created_at}`);
      console.log('');
      console.log('Next Steps:');
      console.log('1. Verify discussion_state was created with turn_index=0, round=1');
      console.log('2. Verify discussion_participants were created in sequence');
      console.log('3. Use this UUID in chat messages to test the full flow');
      console.log('');
      console.log(`SQL to verify state:`);
      console.log(`  SELECT * FROM discussion_state WHERE project_id = '${data.project.id}';`);
      console.log(`  SELECT * FROM discussion_participants WHERE project_id = '${data.project.id}' ORDER BY sequence_order;`);
    } else {
      console.log('✗ ERROR: Project initialization failed');
      console.log(`Message: ${data.message}`);
      console.log('');
      console.log('Common Issues:');
      console.log('- Missing SUPABASE_SERVICE_ROLE_KEY in environment');
      console.log('- Database migrations not applied');
      console.log('- Database connection issues');
    }

    return data;
  } catch (error) {
    console.log('✗ EXCEPTION: An error occurred');
    console.error('Error:', error.message);
    console.log('');
    console.log('Possible Causes:');
    console.log('- API server not running (start with: npm run dev)');
    console.log('- Network connectivity issues');
    return null;
  } finally {
    console.log('='.repeat(60));
  }
}

// Get project name from command line or use default
const projectName = process.argv[2] || 'Berner Oberland Tourism';

testProjectInit(projectName).then(() => {
  process.exit(0);
});
