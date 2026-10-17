<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of your project. PostHog client-side analytics (`posthog-js`) was already initialized in the project with a `captureEvent` helper, a `PostHogProvider`, and `PostHogPageView` for route tracking. This integration extends coverage to four previously untracked areas: the documentation page, the viewport error boundary, all export and share actions in the editor toolbar, and context-aware theme/accent change events. Environment variables (`NEXT_PUBLIC_POSTHOG_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`) have been written to `.env.local`.

| Event | Description | File |
|---|---|---|
| `documentation_viewed` | User lands on the documentation page | `apps/graph/components/documentation/DocumentationClientPage.tsx` |
| `documentation_open_editor_clicked` | User clicks 'Open Editor' from the documentation page | `apps/graph/components/documentation/DocumentationClientPage.tsx` |
| `documentation_back_to_landing_clicked` | User clicks 'Back to Landing' from the documentation page | `apps/graph/components/documentation/DocumentationClientPage.tsx` |
| `documentation_section_clicked` | User clicks a table-of-contents link (with `section` property) | `apps/graph/components/documentation/DocumentationClientPage.tsx` |
| `editor_error_boundary_shown` | Viewport error boundary caught a render error (with `feature_area`, `error_name`) | `apps/graph/components/graph/GraphViewportErrorBoundary.tsx` |
| `share_dialog_opened` | User opened the share/export dialog | `apps/graph/components/editor/TopToolbar.tsx` |
| `share_link_copied` | User successfully copied a share link (with `object_count`) | `apps/graph/components/editor/TopToolbar.tsx` |
| `share_link_copy_failed` | Share link copy failed (with `error_type`) | `apps/graph/components/editor/TopToolbar.tsx` |
| `export_json_clicked` | User triggered a JSON scene export (with `object_count`) | `apps/graph/components/editor/TopToolbar.tsx` |
| `export_2d_png_clicked` | User triggered a 2D PNG export (with `object_count`) | `apps/graph/components/editor/TopToolbar.tsx` |
| `export_2d_svg_clicked` | User triggered a 2D SVG export (with `object_count`) | `apps/graph/components/editor/TopToolbar.tsx` |
| `export_3d_png_clicked` | User triggered a 3D PNG export (with `object_count`) | `apps/graph/components/editor/TopToolbar.tsx` |
| `export_succeeded` | Export completed successfully (with `format`) | `apps/graph/components/editor/TopToolbar.tsx` |
| `export_failed` | Export failed (with `format`, `error_type`) | `apps/graph/components/editor/TopToolbar.tsx` |
| `project_saved` | User successfully saved a named project (with `mode`, `object_count`) | `apps/graph/components/editor/TopToolbar.tsx` |
| `project_save_failed` | Project save failed (with `mode`, `error_type`) | `apps/graph/components/editor/TopToolbar.tsx` |
| `project_opened` | User loaded an existing project (with `object_count`) | `apps/graph/components/editor/TopToolbar.tsx` |
| `project_deleted` | User deleted a local project | `apps/graph/components/editor/TopToolbar.tsx` |
| `editor_theme_changed` | User changed theme from inside the editor (with `theme`) | `apps/graph/components/theme/ThemeAccentPopover.tsx` |
| `editor_accent_changed` | User changed accent color from inside the editor (with `accent`) | `apps/graph/components/theme/ThemeAccentPopover.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/405873/dashboard/1534352
- **Landing → Editor conversion funnel**: https://us.posthog.com/project/405873/insights/7OtSIJvl
- **Documentation → Editor conversion**: https://us.posthog.com/project/405873/insights/Yr1stHT0
- **Export format popularity**: https://us.posthog.com/project/405873/insights/yL1qofrv
- **Share adoption funnel**: https://us.posthog.com/project/405873/insights/iJjL76dq
- **Project engagement over time**: https://us.posthog.com/project/405873/insights/PuGklQaA

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
