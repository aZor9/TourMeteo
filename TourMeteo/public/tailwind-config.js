// Config Tailwind (CDN) externalisée : évite un <script> inline dans index.html
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'primary':          '#1B5A96',
        'primary-dark':     '#144A7E',
        'primary-light':    '#E8F2FB',
        'beige':            '#B8935A',
        'beige-dark':       '#9A7A48',
        'beige-light':      '#F5EDD8',
        'warm':             '#EDE8DB',
        'background-light': '#F5F2EC',
        'background-dark':  '#0F1820'
      },
      fontFamily: {
        'display': ['Space Grotesk']
      },
      borderRadius: { 'DEFAULT': '0.375rem', 'lg': '0.625rem', 'xl': '0.875rem', '2xl': '1.25rem', 'full': '9999px' }
    }
  }
};
