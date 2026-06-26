"use client";

export function ProgressStyles() {
  return (
    <style jsx global>{`
      .progressTrack {
        width: 100%;
        height: 0.55rem;
        overflow: hidden;
        appearance: none;
        border: 0;
        border-radius: 9999px;
        background: var(--glass-bg);
        box-shadow:
          inset 0 1px 2px color-mix(in srgb, CanvasText 45%, transparent),
          0 0 0 1px var(--glass-border);
      }

      .progressTrack::-webkit-progress-bar {
        border-radius: 9999px;
        background: var(--glass-bg);
      }

      .progressTrack::-webkit-progress-value {
        border-radius: 9999px;
        transition:
          width 180ms ease,
          background 180ms ease,
          box-shadow 180ms ease;
      }

      .progressTrack::-moz-progress-bar {
        border-radius: 9999px;
        transition:
          width 180ms ease,
          background 180ms ease,
          box-shadow 180ms ease;
      }

      .progressProcessing::-webkit-progress-value {
        background: linear-gradient(90deg, var(--admin-accent), var(--reactor-blue));
        box-shadow: 0 0 8px color-mix(in srgb, var(--admin-accent) 35%, transparent);
      }

      .progressProcessing::-moz-progress-bar {
        background: linear-gradient(90deg, var(--admin-accent), var(--reactor-blue));
        box-shadow: 0 0 8px color-mix(in srgb, var(--admin-accent) 35%, transparent);
      }

      .progressCompleted::-webkit-progress-value {
        background: linear-gradient(90deg, var(--admin-success), color-mix(in srgb, var(--admin-success) 70%, CanvasText));
        box-shadow: 0 0 10px color-mix(in srgb, var(--admin-success) 35%, transparent);
      }

      .progressCompleted::-moz-progress-bar {
        background: linear-gradient(90deg, var(--admin-success), color-mix(in srgb, var(--admin-success) 70%, CanvasText));
        box-shadow: 0 0 10px color-mix(in srgb, var(--admin-success) 35%, transparent);
      }

      .progressFailed::-webkit-progress-value {
        background: linear-gradient(90deg, var(--admin-danger), color-mix(in srgb, var(--admin-danger) 70%, CanvasText));
        box-shadow: 0 0 10px color-mix(in srgb, var(--admin-danger) 35%, transparent);
      }

      .progressFailed::-moz-progress-bar {
        background: linear-gradient(90deg, var(--admin-danger), color-mix(in srgb, var(--admin-danger) 70%, CanvasText));
        box-shadow: 0 0 10px color-mix(in srgb, var(--admin-danger) 35%, transparent);
      }

      .progressWaiting::-webkit-progress-value {
        background: linear-gradient(90deg, var(--admin-warning), color-mix(in srgb, var(--admin-warning) 70%, CanvasText));
        box-shadow: 0 0 10px color-mix(in srgb, var(--admin-warning) 30%, transparent);
      }

      .progressWaiting::-moz-progress-bar {
        background: linear-gradient(90deg, var(--admin-warning), color-mix(in srgb, var(--admin-warning) 70%, CanvasText));
        box-shadow: 0 0 10px color-mix(in srgb, var(--admin-warning) 30%, transparent);
      }

      .progressStuck::-webkit-progress-value {
        background: linear-gradient(90deg, var(--admin-accent), color-mix(in srgb, var(--admin-accent) 55%, CanvasText));
        box-shadow: 0 0 10px color-mix(in srgb, var(--admin-accent) 35%, transparent);
      }

      .progressStuck::-moz-progress-bar {
        background: linear-gradient(90deg, var(--admin-accent), color-mix(in srgb, var(--admin-accent) 55%, CanvasText));
        box-shadow: 0 0 10px color-mix(in srgb, var(--admin-accent) 35%, transparent);
      }
    `}</style>
  );
}



