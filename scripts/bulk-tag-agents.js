#!/usr/bin/env node

/**
 * Bulk Agent Templates Metadata Standardization Script
 * 
 * This script updates agent_templates to standardize metadata for intelligent selection.
 * 
 * Usage:
 *   node scripts/bulk-tag-agents.js [--dry-run]
 * 
 * Options:
 *   --dry-run: Show what would be updated without making changes
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: Supabase credentials not configured');
  console.error('Required environment variables:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const DRY_RUN = process.argv.includes('--dry-run');

console.log('='.repeat(70));
console.log('Agent Templates Bulk Metadata Standardization');
console.log('='.repeat(70));
console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE UPDATE'}`);
console.log('');

/**
 * Categorization rules
 */
const CATEGORIZATION_RULES = {
  design: {
    discipline: 'frontend_design',
    keywords: ['responsive', 'ux', 'visuals'],
    patterns: ['design', 'ui', 'ux', 'user interface']
  },
  devops: {
    discipline: 'infrastructure',
    keywords: ['deployment', 'scaling', 'security'],
    patterns: ['devops', 'cloud', 'infrastructure', 'deployment']
  },
  manager: {
    engine_type: 'manager_logic',
    patterns: ['manager', 'lead', 'director']
  },
  tourism: {
    category: 'tourism',
    patterns: ['tourism', 'tourismus', 'hotel', 'guide', 'berner oberland', 'destination']
  }
};

function matchesPatterns(text, patterns) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return patterns.some(pattern => lowerText.includes(pattern));
}

function generateCodeName(name, id) {
  // Normalize name: remove special chars, replace spaces with underscores, uppercase
  const normalized = name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .toUpperCase();
  
  // Add first 8 chars of UUID for uniqueness
  const idPrefix = id.substring(0, 8);
  
  return `${normalized}_${idPrefix}`;
}

async function loadAgents() {
  console.log('Loading agents from database...');
  const { data, error } = await supabase
    .from('agent_templates')
    .select('*');
  
  if (error) {
    throw new Error(`Failed to load agents: ${error.message}`);
  }
  
  console.log(`Found ${data.length} agents`);
  console.log('');
  return data;
}

async function analyzeAgents(agents) {
  console.log('Analyzing agents for categorization...');
  console.log('');
  
  const updates = [];
  const stats = {
    design: 0,
    devops: 0,
    manager: 0,
    tourism: 0,
    needsCodeName: 0,
    needsProvider: 0
  };
  
  for (const agent of agents) {
    const update = { id: agent.id, changes: {} };
    let hasChanges = false;
    
    // Check design patterns
    if (matchesPatterns(agent.name, CATEGORIZATION_RULES.design.patterns) ||
        matchesPatterns(agent.description, CATEGORIZATION_RULES.design.patterns)) {
      if (!agent.discipline || agent.discipline === '') {
        update.changes.discipline = CATEGORIZATION_RULES.design.discipline;
        update.changes.trigger_keywords = [
          ...(agent.trigger_keywords || []),
          ...CATEGORIZATION_RULES.design.keywords
        ];
        hasChanges = true;
        stats.design++;
      }
    }
    
    // Check devops patterns
    if (matchesPatterns(agent.name, CATEGORIZATION_RULES.devops.patterns) ||
        matchesPatterns(agent.description, CATEGORIZATION_RULES.devops.patterns)) {
      if (!agent.discipline || agent.discipline === '') {
        update.changes.discipline = CATEGORIZATION_RULES.devops.discipline;
        update.changes.trigger_keywords = [
          ...(agent.trigger_keywords || []),
          ...CATEGORIZATION_RULES.devops.keywords
        ];
        hasChanges = true;
        stats.devops++;
      }
    }
    
    // Check manager patterns
    if (matchesPatterns(agent.name, CATEGORIZATION_RULES.manager.patterns) ||
        matchesPatterns(agent.description, CATEGORIZATION_RULES.manager.patterns)) {
      if (!agent.engine_type || agent.engine_type === '') {
        update.changes.engine_type = CATEGORIZATION_RULES.manager.engine_type;
        hasChanges = true;
        stats.manager++;
      }
    }
    
    // Check tourism patterns
    if (matchesPatterns(agent.name, CATEGORIZATION_RULES.tourism.patterns) ||
        matchesPatterns(agent.description, CATEGORIZATION_RULES.tourism.patterns)) {
      if (!agent.category || agent.category === '' || agent.category !== 'tourism') {
        update.changes.category = CATEGORIZATION_RULES.tourism.category;
        hasChanges = true;
        stats.tourism++;
      }
    }
    
    // Generate code_name if missing
    if (!agent.code_name || agent.code_name === '') {
      update.changes.code_name = generateCodeName(agent.name, agent.id);
      hasChanges = true;
      stats.needsCodeName++;
    }
    
    // Standardize provider and model
    if (!agent.provider || agent.provider === '' || agent.provider === 'xAI') {
      update.changes.provider = 'groq';
      update.changes.model_name = 'llama-3.1-8b-instant';
      hasChanges = true;
      stats.needsProvider++;
    }
    
    if (hasChanges) {
      update.name = agent.name;
      updates.push(update);
    }
  }
  
  console.log('Analysis Results:');
  console.log(`  Design/UI agents to update: ${stats.design}`);
  console.log(`  DevOps/Infrastructure agents to update: ${stats.devops}`);
  console.log(`  Manager/Lead agents to update: ${stats.manager}`);
  console.log(`  Tourism category agents to update: ${stats.tourism}`);
  console.log(`  Agents needing code_name: ${stats.needsCodeName}`);
  console.log(`  Agents needing provider update: ${stats.needsProvider}`);
  console.log(`  Total agents with updates: ${updates.length}`);
  console.log('');
  
  return updates;
}

async function applyUpdates(updates) {
  if (DRY_RUN) {
    console.log('DRY RUN - Showing first 10 updates that would be applied:');
    console.log('');
    updates.slice(0, 10).forEach((update, i) => {
      console.log(`${i + 1}. ${update.name} (${update.id.substring(0, 8)}...)`);
      console.log(`   Changes:`, JSON.stringify(update.changes, null, 2));
      console.log('');
    });
    if (updates.length > 10) {
      console.log(`   ... and ${updates.length - 10} more`);
    }
    return;
  }
  
  console.log('Applying updates...');
  let successCount = 0;
  let errorCount = 0;
  
  for (const update of updates) {
    try {
      const { error } = await supabase
        .from('agent_templates')
        .update(update.changes)
        .eq('id', update.id);
      
      if (error) {
        console.error(`  ✗ Failed to update ${update.name}: ${error.message}`);
        errorCount++;
      } else {
        successCount++;
        if (successCount % 10 === 0) {
          console.log(`  Progress: ${successCount}/${updates.length} updated...`);
        }
      }
    } catch (err) {
      console.error(`  ✗ Error updating ${update.name}:`, err.message);
      errorCount++;
    }
  }
  
  console.log('');
  console.log('Update Results:');
  console.log(`  ✓ Successful: ${successCount}`);
  console.log(`  ✗ Failed: ${errorCount}`);
}

async function ensureUniqueCodeNames() {
  console.log('');
  console.log('Ensuring code_names are unique...');
  
  const { data: agents, error } = await supabase
    .from('agent_templates')
    .select('id, code_name, created_at')
    .order('code_name')
    .order('created_at');
  
  if (error) {
    console.error('Failed to load agents for uniqueness check:', error.message);
    return;
  }
  
  // Group by code_name
  const grouped = {};
  agents.forEach(agent => {
    if (!grouped[agent.code_name]) {
      grouped[agent.code_name] = [];
    }
    grouped[agent.code_name].push(agent);
  });
  
  // Find duplicates
  const duplicates = Object.entries(grouped).filter(([_, list]) => list.length > 1);
  
  if (duplicates.length === 0) {
    console.log('  ✓ All code_names are unique');
    return;
  }
  
  console.log(`  Found ${duplicates.length} duplicate code_names`);
  
  if (DRY_RUN) {
    console.log('  DRY RUN - Would fix duplicates by appending sequence numbers');
    return;
  }
  
  // Fix duplicates by appending sequence numbers
  for (const [codeName, list] of duplicates) {
    for (let i = 1; i < list.length; i++) {
      const newCodeName = `${codeName}_${i + 1}`;
      const { error } = await supabase
        .from('agent_templates')
        .update({ code_name: newCodeName })
        .eq('id', list[i].id);
      
      if (error) {
        console.error(`  ✗ Failed to fix duplicate ${codeName}:`, error.message);
      }
    }
  }
  
  console.log('  ✓ Fixed duplicate code_names');
}

async function main() {
  try {
    const agents = await loadAgents();
    const updates = await analyzeAgents(agents);
    
    if (updates.length === 0) {
      console.log('✓ No updates needed - all agents are already standardized');
      return;
    }
    
    await applyUpdates(updates);
    await ensureUniqueCodeNames();
    
    console.log('');
    console.log('='.repeat(70));
    console.log('✓ Bulk standardization complete!');
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('');
    console.error('✗ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
