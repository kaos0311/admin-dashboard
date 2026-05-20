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
        background: rgb(255 255 255 / 0.06);
        box-shadow:
          inset 0 1px 2px rgb(0 0 0 / 0.45),
          0 0 0 1px rgb(255 255 255 / 0.04);
      }

      .progressTrack::-webkit-progress-bar {
        border-radius: 9999px;
        background: rgb(255 255 255 / 0.06);
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
        background: linear-gradient(90deg, rgb(34 211 238), rgb(59 130 246));
        box-shadow: 0 0 8px rgb(34 211 238 / 0.35);
      }

      .progressProcessing::-moz-progress-bar {
        background: linear-gradient(90deg, rgb(34 211 238), rgb(59 130 246));
        box-shadow: 0 0 8px rgb(34 211 238 / 0.35);
      }

      .progressCompleted::-webkit-progress-value {
        background: linear-gradient(90deg, rgb(16 185 129), rgb(110 231 183));
        box-shadow: 0 0 10px rgb(16 185 129 / 0.35);
      }

      .progressCompleted::-moz-progress-bar {
        background: linear-gradient(90deg, rgb(16 185 129), rgb(110 231 183));
        box-shadow: 0 0 10px rgb(16 185 129 / 0.35);
      }

      .progressFailed::-webkit-progress-value {
        background: linear-gradient(90deg, rgb(239 68 68), rgb(248 113 113));
        box-shadow: 0 0 10px rgb(239 68 68 / 0.35);
      }

      .progressFailed::-moz-progress-bar {
        background: linear-gradient(90deg, rgb(239 68 68), rgb(248 113 113));
        box-shadow: 0 0 10px rgb(239 68 68 / 0.35);
      }

      .progressWaiting::-webkit-progress-value {
        background: linear-gradient(90deg, rgb(245 158 11), rgb(252 211 77));
        box-shadow: 0 0 10px rgb(245 158 11 / 0.3);
      }

      .progressWaiting::-moz-progress-bar {
        background: linear-gradient(90deg, rgb(245 158 11), rgb(252 211 77));
        box-shadow: 0 0 10px rgb(245 158 11 / 0.3);
      }

      .progressStuck::-webkit-progress-value {
        background: linear-gradient(90deg, rgb(168 85 247), rgb(192 132 252));
        box-shadow: 0 0 10px rgb(168 85 247 / 0.35);
      }

      .progressStuck::-moz-progress-bar {
        background: linear-gradient(90deg, rgb(168 85 247), rgb(192 132 252));
        box-shadow: 0 0 10px rgb(168 85 247 / 0.35);
      }
    `}</style>
  );
}