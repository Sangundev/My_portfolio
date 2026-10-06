(() => {
  // [href, tiêu đề, dòng phụ]
  const LINKS = [
    ['mailto:your@email.com', 'Email',   'your@email.com'],
    ['tel:+84000000000',      'Phone',   '+84 000 000 000'],
    ['#',                     'Behance', 'behance.net/yourname']
  ];

  function build(body, _title, api) {
    const l = api.h('div', 'links');
    l.append(...LINKS.map(([href, t, sub]) => api.link(href, t, sub)));
    body.append(l);
  }

  (window.WMApps = window.WMApps || {}).contact = { title: 'Contact', w: 440, h: 320, cls: 'is-contact', build };
})();