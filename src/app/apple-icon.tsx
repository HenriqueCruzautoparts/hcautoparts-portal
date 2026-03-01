import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function Icon() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#1C1C1E',
                    borderRadius: '40px',
                }}
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100" height="100">
                    <g fill="none" stroke="#FF2D55" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="7" height="9" x="3" y="3" rx="1" />
                        <rect width="7" height="5" x="14" y="3" rx="1" />
                        <rect width="7" height="9" x="14" y="12" rx="1" />
                        <rect width="7" height="5" x="3" y="16" rx="1" />
                    </g>
                </svg>
            </div>
        ),
        { ...size }
    )
}
