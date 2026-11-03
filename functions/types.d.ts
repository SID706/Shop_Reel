export interface Env {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
}

export type PagesFunction<Environment = Env> = (context: {
  request: Request
  env: Environment
  params: Record<string, string>
}) => Response | Promise<Response>
