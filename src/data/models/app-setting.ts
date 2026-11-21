/**
 * Modelo de dominio: app_settings (almacén clave-valor con JSON).
 */

export interface AppSetting {
  key: string;
  value_json: string;
  updated_at: string;
}

export interface UpsertAppSettingInput {
  key: string;
  value: unknown;
}
