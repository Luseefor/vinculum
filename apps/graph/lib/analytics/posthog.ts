import posthog from "posthog-js";

export function getToken(): string | undefined {
  return process.env.NEXT_PUBLIC_POSTHOG_TOKEN;
}

export function getHost(): string {
  return process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
}

export type AnalyticsEvent =
  | "landing_viewed"
  | "landing_open_editor_clicked"
  | "landing_open_examples_clicked"
  | "landing_open_documentation_clicked"
  | "landing_theme_changed"
  | "landing_accent_changed"
  | "documentation_viewed"
  | "documentation_section_clicked"
  | "documentation_open_editor_clicked"
  | "documentation_back_to_landing_clicked"
  | "editor_opened"
  | "editor_examples_entry_opened"
  | "editor_shared_scene_detected"
  | "editor_shared_scene_failed"
  | "editor_theme_changed"
  | "editor_accent_changed"
  | "project_save_clicked"
  | "project_saved"
  | "project_save_failed"
  | "project_opened"
  | "project_deleted"
  | "autosave_started"
  | "autosave_succeeded"
  | "autosave_failed"
  | "recovery_prompt_shown"
  | "recovery_restored"
  | "recovery_discarded"
  | "object_added"
  | "object_deleted"
  | "object_selected"
  | "object_visibility_toggled"
  | "tool_selected"
  | "pin_created"
  | "distance_measurement_created"
  | "angle_measurement_created"
  | "measurement_deleted"
  | "share_dialog_opened"
  | "share_link_copied"
  | "share_link_copy_failed"
  | "export_json_clicked"
  | "export_2d_png_clicked"
  | "export_2d_svg_clicked"
  | "export_3d_png_clicked"
  | "export_succeeded"
  | "export_failed"
  | "editor_error_boundary_shown"
  | "viewport_fallback_shown"
  | "import_payload_rejected"
  | "expression_rejected"
  | "heavy_scene_warning_shown";

/**
 * Sanitizes properties by removing forbidden fields:
 * - equations/expressions
 * - scene JSON
 * - project names
 * - full URLs
 * - raw error stacks
 */
export function sanitizeProperties(properties?: Record<string, any>): Record<string, any> | undefined {
  if (!properties) return undefined;

  const sanitized = { ...properties };

  // Forbidden fields
  const forbiddenKeys = [
    "equation",
    "expression",
    "scene",
    "projectName",
    "url",
    "fullUrl",
    "stack",
    "errorStack",
    "payload",
    "rawPayload",
    "xExpr",
    "yExpr",
    "zExpr"
  ];

  for (const key of forbiddenKeys) {
    delete sanitized[key];
  }

  // Deeply sanitize objects if they exist
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeProperties(value);
    }
  }

  return sanitized;
}

export function isAnalyticsEnabled(): boolean {
  return typeof window !== "undefined" && !!getToken();
}

export function captureEvent(name: AnalyticsEvent, properties?: Record<string, any>) {
  if (!isAnalyticsEnabled()) return;

  try {
    const sanitizedProps = sanitizeProperties(properties);
    posthog.capture(name, sanitizedProps);
  } catch (err) {
    // Fail silently to avoid crashing the app
    if (typeof console !== "undefined" && console.warn) {
      console.warn("Analytics capture failed", err);
    }
  }
}
