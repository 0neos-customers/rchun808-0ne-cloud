// Notification Preferences database types

/**
 * Delivery method for notifications
 */
export type DeliveryMethod = 'email' | 'sms' | 'both'

/**
 * Configuration for which metrics to include in daily snapshots
 * All fields default to true
 */
export interface MetricsConfig {
  revenue: boolean
  leads: boolean
  clients: boolean
  fundedAmount: boolean
  adSpend: boolean
  costPerLead: boolean
  skoolMembers: boolean
  skoolConversion: boolean
}

/**
 * Threshold settings for a single metric
 * Set min/max to null to disable that threshold
 */
export interface MetricThreshold {
  min: number | null
  max: number | null
}

/**
 * Alert thresholds configuration
 * Keys match MetricsConfig keys
 */
export interface AlertThresholds {
  revenue?: MetricThreshold
  leads?: MetricThreshold
  clients?: MetricThreshold
  fundedAmount?: MetricThreshold
  adSpend?: MetricThreshold
  costPerLead?: MetricThreshold
  skoolMembers?: MetricThreshold
  skoolConversion?: MetricThreshold
}

/**
 * User notification preferences (database row)
 */
export interface NotificationPreferences {
  clerk_user_id: string
  daily_snapshot_enabled: boolean
  delivery_time: string // TIME format: 'HH:MM:SS'
  delivery_email: string | null
  delivery_method: DeliveryMethod
  metrics_config: MetricsConfig
  alert_thresholds: AlertThresholds
  created_at: string
  updated_at: string
}

/**
 * Input for creating/updating notification preferences
 * All fields optional except user_id (which comes from auth)
 */
export interface NotificationPreferencesInput {
  daily_snapshot_enabled?: boolean
  delivery_time?: string
  delivery_email?: string | null
  delivery_method?: DeliveryMethod
  metrics_config?: Partial<MetricsConfig>
  alert_thresholds?: AlertThresholds
}

/**
 * Default metrics configuration
 */
export const DEFAULT_METRICS_CONFIG: MetricsConfig = {
  revenue: true,
  leads: true,
  clients: true,
  fundedAmount: true,
  adSpend: true,
  costPerLead: true,
  skoolMembers: true,
  skoolConversion: true,
}

/**
 * Default notification preferences for new users
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<NotificationPreferences, 'clerk_user_id' | 'created_at' | 'updated_at'> = {
  daily_snapshot_enabled: false,
  delivery_time: '08:00:00',
  delivery_email: null,
  delivery_method: 'email',
  metrics_config: DEFAULT_METRICS_CONFIG,
  alert_thresholds: {},
}
