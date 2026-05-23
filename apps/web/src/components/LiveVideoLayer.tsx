const DEMO_VIDEO = '/demo/live-room.mp4';
const DEMO_POSTER =
  'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&q=80';

export default function LiveVideoLayer() {
  return (
    <div style={{ position: 'relative', width: '100%', background: '#000', aspectRatio: '16/9' }}>
      <video
        src={DEMO_VIDEO}
        poster={DEMO_POSTER}
        autoPlay
        loop
        muted
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={(e) => {
          const el = e.currentTarget;
          el.style.display = 'none';
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          background: 'rgba(255,0,0,0.85)',
          color: '#fff',
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        LIVE
      </div>
      <img
        src={DEMO_POSTER}
        alt="直播封面"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: -1,
        }}
      />
    </div>
  );
}
