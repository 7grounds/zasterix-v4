-- Migration: Add RLS policies for projects table
-- This ensures authenticated users can create and read projects

-- Enable RLS on projects table if not already enabled
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Policy 1: Service role has full access (for API routes using service key)
CREATE POLICY "Service role can manage all projects"
ON public.projects FOR ALL
USING (auth.role() = 'service_role');

-- Policy 2: Authenticated users can read projects in their organization
CREATE POLICY "Users can view projects in their org"
ON public.projects FOR SELECT
USING (
  auth.role() = 'authenticated' 
  AND (
    organization_id = (auth.jwt()->>'organization_id')::uuid
    OR organization_id IS NULL  -- Allow access to projects without org
  )
);

-- Policy 3: Authenticated users can insert projects in their organization
CREATE POLICY "Users can create projects in their org"
ON public.projects FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND (
    organization_id = (auth.jwt()->>'organization_id')::uuid
    OR organization_id IS NULL
  )
);

-- Policy 4: Authenticated users can update projects in their organization
CREATE POLICY "Users can update projects in their org"
ON public.projects FOR UPDATE
USING (
  auth.role() = 'authenticated'
  AND (
    organization_id = (auth.jwt()->>'organization_id')::uuid
    OR organization_id IS NULL
  )
);

-- Policy 5: Authenticated users can delete projects in their organization
CREATE POLICY "Users can delete projects in their org"
ON public.projects FOR DELETE
USING (
  auth.role() = 'authenticated'
  AND (
    organization_id = (auth.jwt()->>'organization_id')::uuid
    OR organization_id IS NULL
  )
);

-- Add helpful comment
COMMENT ON TABLE public.projects IS 'Projects table with RLS policies. Service role has full access. Authenticated users can access projects in their organization.';
