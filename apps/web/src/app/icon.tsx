import { color } from '@league/ui-tokens';
import { ImageResponse } from 'next/og';

export const size = { height: 64, width: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: 'center',
        background: color.action.primary.default,
        borderRadius: 16,
        display: 'flex',
        height: '100%',
        justifyContent: 'center',
        width: '100%',
      }}
    >
      <div
        style={{
          borderBottom: `8px solid ${color.action.primary.foreground}`,
          borderLeft: `8px solid ${color.action.primary.foreground}`,
          height: 34,
          width: 28,
        }}
      />
    </div>,
    size,
  );
}
