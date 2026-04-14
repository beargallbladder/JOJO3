export type AppEnv = {
  Variables: {
    org_id: string;
    actor_id: string;
    actor_type: 'user' | 'system' | 'api_key';
  };
};
