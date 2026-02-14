 -- Standardizing names to match your Master Commands
UPDATE agent_templates SET name = 'Designer' WHERE name = 'UI/UX Designer';
UPDATE agent_templates SET name = 'DevOps' WHERE name = 'DevOps Engineer';

-- Ensure Manager Alpha knows the short names too
UPDATE agent_templates 
SET system_prompt = 'You are Manager Alpha. Lead the discussion. Summon "Designer" for UI and "DevOps" for technical automation. End your turn by name-dropping them.'
WHERE name = 'Manager Alpha';
