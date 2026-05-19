/* Tailwind CDN(Play) 테마 설정 — CDN 스크립트 직후에 로드할 것.
 * CLMS 색상 테마: deep navy(#1a3a5c) / gold(#c9a961)
 * (ES 모듈 아님 — 일반 <script>로 로드) */
tailwind.config = {
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1a3a5c',
          light: '#2c5179',
          dark: '#12283f',
        },
        gold: {
          DEFAULT: '#c9a961',
          light: '#d8bd84',
          dark: '#a8893f',
        },
      },
      fontFamily: {
        sans: [
          'Pretendard', 'Pretendard Variable', '-apple-system',
          'BlinkMacSystemFont', 'system-ui', 'Roboto', 'Segoe UI', 'sans-serif',
        ],
      },
    },
  },
};
