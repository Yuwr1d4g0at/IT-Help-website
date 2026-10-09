"""Generate the desktop-style homepage body for EN and PT.

Run from the repo root. Replaces everything between <body> and </body> in
index.html and pt/index.html, leaving <head> alone.

Add real client reviews to REVIEWS (near the bottom), then run:
    python3 scripts/build_home.py
"""
import re
from urllib.parse import quote
import sys

# App-style icons: a rounded square with a colour gradient (CSS) and a
# white line glyph on top. Plain icons are just the glyph in currentColor.
GLYPHS = {
    'services': 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3.6 17.4a1.9 1.9 0 0 0 2.7 2.7l5.7-5.7a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
    'prices': 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z M7.5 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 1 0 0-3z',
    'software': 'M12 3v12 M7 10l5 5 5-5 M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
    'tips': 'M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.8 10.6c.6.5.8 1.2.8 1.9V16h6v-.5c0-.7.3-1.4.8-1.9A6 6 0 0 0 12 3z',
    'tools': 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
    'contact': 'M3 6h18v12H3z M3.5 6.5 12 13l8.5-6.5',
    'logo': 'M6 4l6 8 6-8 M12 12v8',
    'gear': 'M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6z M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1M18.5 18.5l-2.1-2.1M7.6 7.6 5.5 5.5',
    'code': 'M3 5h18v14H3z M3 9h18 M9 13l-2 2 2 2 M15 13l2 2-2 2',
    'chip': 'M7 7h10v10H7z M10 10h4v4h-4z M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
    'shield': 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z M9 12l2 2 4-4',
    'download': 'M12 3v11 M8 10l4 4 4-4 M4 18.5h16',
    'refresh': 'M4 12a8 8 0 0 1 14-5.2M20 12a8 8 0 0 1-14 5.2 M17 3v4h-4 M7 21v-4h4',
    'globe': 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z M3 12h18 M12 3c2.8 2.5 2.8 15.5 0 18 M12 3c-2.8 2.5-2.8 15.5 0 18',
    'clock': 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z M12 7v5l3.5 2',
    'help': 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.3 M12 17h.01',
    'pc': 'M3 4h18v12H3z M8 20h8 M12 16v4',
    'checklist': 'M10 6h10 M10 12h10 M10 18h10 M4 6l1.2 1.2L7.5 5 M4 12l1.2 1.2L7.5 11 M4 18l1.2 1.2L7.5 17',
    'glossary': 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z M5 19.5A1.5 1.5 0 0 0 6.5 21H19',
    'warning': 'M12 3.5 21.5 20h-19z M12 10v4 M12 17h.01',
    'info': 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z M12 11v6 M12 7.5h.01',
    'user': 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4.5 20.5a7.5 7.5 0 0 1 15 0',
    'note': 'M6 3h9l4 4v14H6z M14.5 3v4.5H19 M9 12h7 M9 16h5',
    'send': 'M21 3 3 10.5l7 3 3 7z M10 13.5 21 3',
    'phone': 'M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z',
    'chat': 'M4 5.5A2 2 0 0 1 6 3.5h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 3.5v-3.5H6a2 2 0 0 1-2-2z',
    'bulb': 'M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.8 10.6c.6.5.8 1.2.8 1.9V16h6v-.5c0-.7.3-1.4.8-1.9A6 6 0 0 0 12 3z',
    'check': 'M5 12.5l4.5 4.5L19 7.5',
    'pin': 'M12 21c-4-4.5-7-8-7-11.5A7 7 0 0 1 12 2a7 7 0 0 1 7 7.5C19 13 16 16.5 12 21z M12 7.2a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 1 0 0-4.6z',
    'wrench': 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3.6 17.4a1.9 1.9 0 0 0 2.7 2.7l5.7-5.7a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
    'mail': 'M3 6h18v12H3z M3.5 6.5 12 13l8.5-6.5',
    'book': 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4 M8 14h3 M13 14h3 M8 17h3',
    'reviews': 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
    'launchpad': 'M4 4h4v4H4z M10 4h4v4h-4z M16 4h4v4h-4z M4 10h4v4H4z M10 10h4v4h-4z M16 10h4v4h-4z M4 16h4v4H4z M10 16h4v4h-4z M16 16h4v4h-4z',
    'control': 'M4 7h10 M18 7h2 M4 17h2 M10 17h10 M16 5v4 M8 15v4',
    'mission': 'M2 6h9v7H2z M13 6h9v7h-9z M7 15h10v5H7z',
    'key': 'M15 3a6 6 0 1 0 0 12 6 6 0 0 0 0-12z M10.8 13.2 3 21 M6 18l2 2 M8.5 15.5l2 2',
    'ruler': 'M3 17 17 3l4 4L7 21z M7 13l2 2 M10 10l2 2 M13 7l2 2',
    'w11': 'M4 5h16v11H4z M2 20h20 M9 10.5l2 2 4-4',
    'search': 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z M20 20l-4.6-4.6',
}

COLORS = {
    'services': ('#8F8CFF', '#5856D6'), 'prices': ('#4CD964', '#1F9D45'), 'software': ('#C77DFF', '#7D3CC8'),
    'tips': ('#FFD54A', '#FF9F0A'), 'tools': ('#A1A1A8', '#5A5A60'), 'contact': ('#5AC8FA', '#0A6CFF'),
    'logo': ('#FF7A45', '#B84DFF'), 'gear': ('#A1A1A8', '#5A5A60'), 'code': ('#5AC8FA', '#0A6CFF'),
    'chip': ('#4CD964', '#1F9D45'), 'shield': ('#FF7A6E', '#E0352B'), 'download': ('#C77DFF', '#7D3CC8'),
    'refresh': ('#FFB347', '#FF7A00'), 'globe': ('#4FD1E8', '#0A84FF'), 'clock': ('#6E6E76', '#2C2C30'),
    'help': ('#8F8CFF', '#5856D6'), 'pc': ('#FFB347', '#FF7A00'), 'checklist': ('#FFD54A', '#F2A900'),
    'glossary': ('#FF8F70', '#E5484D'), 'warning': ('#FFD54A', '#FF9500'), 'info': ('#5AC8FA', '#0A6CFF'),
    'user': ('#A1A1A8', '#5A5A60'), 'note': ('#FFE066', '#F5B700'), 'send': ('#5AC8FA', '#0A6CFF'),
    'phone': ('#4CD964', '#1F9D45'), 'chat': ('#4CD964', '#1F9D45'), 'bulb': ('#FFD54A', '#FF9F0A'),
    'book': ('#FF7B7B', '#E5383B'), 'reviews': ('#FFD54A', '#FF9F0A'), 'launchpad': ('#7D96FF', '#3D4FD6'),
    'control': ('#A1A1A8', '#5A5A60'), 'mission': ('#5AC8FA', '#2C6BD6'), 'key': ('#8E8E96', '#3A3A40'),
    'ruler': ('#64D2FF', '#0A84FF'), 'w11': ('#4FD1E8', '#0A84FF'), 'search': ('#A1A1A8', '#5A5A60'),
}


def glyph_svg(name, stroke='currentColor', width=2):
    return (f'<svg viewBox="0 0 24 24" fill="none" stroke="{stroke}" stroke-width="{width}" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
            f'<path d="{GLYPHS[name]}"/></svg>')


def px(name, size=32):
    """Icon markup. 'p-<glyph>' gives a plain line icon, anything else an
    app-style rounded square."""
    if name.startswith('p-'):
        g = name[2:]
        return (f'<svg class="ico" data-icon="{name}" viewBox="0 0 24 24" width="{size}" height="{size}" fill="none" '
                f'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" '
                f'aria-hidden="true" focusable="false"><path d="{GLYPHS[g]}"/></svg>')
    c1, c2 = COLORS[name]
    return (f'<span class="ico ico-app" data-icon="{name}" aria-hidden="true" '
            f'style="width:{size}px;height:{size}px;--c1:{c1};--c2:{c2}">{glyph_svg(name, "#fff")}</span>')


def favicon():
    c1, c2 = COLORS['logo']
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">\n'
            '  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
            f'<stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient></defs>\n'
            '  <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#g)"/>\n'
            '  <path d="M20 17l12 15 12-15 M32 32v16" fill="none" stroke="#fff" stroke-width="6" '
            'stroke-linecap="round" stroke-linejoin="round"/>\n</svg>\n')


def controls():
    return ('<div class="win-controls" aria-hidden="true"><span>&times;</span><span>&minus;</span>'
            '<span>+</span></div>')


def title(icon, text, tag='h2', id_=None):
    idattr = f' id="{id_}"' if id_ else ''
    return (f'<div class="win-title">{px(icon, 16)}<{tag} class="win-title-text"{idattr}>{text}</{tag}>'
            f'{controls()}</div>')


def menu(items):
    return '<div class="win-menu" aria-hidden="true">' + ''.join(f'<span>{m}</span>' for m in items) + '</div>'


T = {
    'en': dict(
        lang='en', home_prefix='', assets='',
        ids=dict(services='services', about='about', contact='contact', area='area', testimonials='testimonials', approach='approach', book='book'),
        nav=[('#services', 'Services'), ('prices/', 'Prices'), ('software/', 'Software'), ('blog/', 'Tips'),
             ('resources/', 'Resources'), ('#about', 'About'), ('#contact', 'Contact')],
        lang_switch=('pt/', 'pt-PT', 'PT'), cta='Contact Me', menu_label='Menu',
        desk=[('#services', 'services', 'My Services'), ('prices/', 'prices', 'Prices'), ('#book', 'book', 'Book a Visit'), ('software/', 'software', 'Software'),
              ('blog/', 'tips', 'Tips'), ('#tools', 'tools', 'Free Tools'), ('#contact', 'contact', 'Contact')],
        welcome_title='Welcome',
        kicker='Welcome to <strong>Yuwri</strong> &middot; IT support in Seixal',
        h1='Computer <span class="accent">Repair</span>',
        tip_head='Did you know&hellip;',
        tagline="If your computer is too slow, doesn't work properly, or doesn't work at all, talk to me.",
        checks=['Home &amp; office visits', 'Remote sessions', 'Pick-up &amp; return'],
        actions=[('#contact', 'Contact Me', True), ('#services', 'My Services', False), ('prices/', 'See Prices', False), ('#tools', 'Free Tools', False)],
        welcome_foot='Repairs &middot; PC builds &middot; Virus removal &middot; Installs &middot; Websites',
        services_title='My Services', menu_items=['File', 'Edit', 'View', 'Help'], address='Address',
        address_path='C:\\Yuwri\\Services',
        services=[
            ('gear', 'Computer Repair', "Your computer doesn't work properly? I'll diagnose the issue and get it running again fast.", 'Contact Me'),
            ('code', 'Website Creation &amp; Maintenance', 'A clean, fast website built around what your business needs, plus ongoing updates so it keeps working long after launch.', 'Contact Me'),
            ('chip', 'PC Building', 'A custom-built PC tailored to your needs and your budget.', None),
            ('shield', 'Virus Removal', 'Get rid of viruses or malware slowing your machine down.', None),
            ('download', 'Program Installation', 'Programs installed safely, and set up right the first time.', None),
            ('refresh', 'Formatting / OS Install', 'A fresh format, or a whole new operating system.', None),
        ],
        objects='6 items', see_prices='See prices &rarr;',
        area_title='Where I Work', area_intro='Home and office visits, plus pick-up and return, across:',
        remote='Remote sessions anywhere in Portugal.',
        hours_title='When',
        hours=[('Monday to Friday', '18:00–22:00'), ('Saturday &amp; Sunday', '10:00–20:00')],
        hours_note="Feel free to message outside these hours. I'll get back to you as soon as I can.",
        prices_btn='See Prices',
        sw_title='Software Setup', sw_h='Not sure what to install?',
        sw_p="Here's the antivirus, VPN, backup, and cleanup software I actually use and recommend to clients.",
        sw_progress='Picking the good stuff&hellip;', sw_btn='See my recommendations &gt;',
        tools_title='A Few Free Extras',
        tools_p='Whether or not you ever hire me: a troubleshooting wizard, a repair-or-replace quiz, printable cheat sheets, a plain-language glossary, and a board for anything worth flagging right now.',
        tools=[('troubleshoot/', 'help', 'Troubleshooting Wizard'), ('repair-or-replace/', 'pc', 'Repair or Replace?'),
               ('cheat-sheets/', 'checklist', 'Cheat Sheets'), ('glossary/', 'glossary', 'Glossary'), ('heads-up/', 'warning', 'Heads Up')],
        about_title='About Me', tabs=['General', 'Services', 'Hours'],
        sys=[('System:', 'Yuwri IT Support'), ('Located in:', 'Seixal, Portugal'), ('Since:', '2023')],
        about_p="Yuwri isn't just a company name. I'm your trusted partner in resolving all your PC issues swiftly and efficiently. Started out of a passion for technology and a commitment to exceptional service, I've been proudly serving individuals and businesses in Seixal since 2023.",
        approach_file='readme.txt', approach_menu=['File', 'Edit', 'Search', 'Help'],
        approach_h='Personalized Approach',
        approach_p="What sets me apart is my personalized approach to IT solutions. I believe in building relationships, not just fixing computers. When you choose Yuwri, you're choosing a friendly, experienced technician who listens to your concerns, understands your unique needs, and tailors solutions that align with your goals.",
        approach_tags=['A friendly, experienced technician', 'Solutions tailored to your goals', 'Real relationships, not tickets'],
        testi_title='What Clients Say', testi_h='New here, honestly.',
        testi_p="I haven't set up a way to collect reviews on the site yet, so there's nothing to show here but a blank space. I'd rather leave it empty than fill it with anything that isn't real. If you'd like to hear from someone I've actually helped, just ask when you reach out.",
        testi_btn='Get in touch',
        contact_title='New Message', send='Send', call='Call', whatsapp='WhatsApp',
        f_to='To:', f_phone='Phone:', f_chat='Chat:', f_from='From:', f_subject='Subject:',
        from_ph='Your name', subject_ph="What's going on?", msg_ph='Tell me what the problem is, what computer you have, and when suits you…',
        contact_h="Let's talk.",
        contact_p="I'd love to hear from you. Write your message here and send it by email or WhatsApp. I usually reply the same day.",
        contact_quote=('Prefer a form?', 'Describe your problem and get a quote &rarr;'),
        send_btn='Send Email', send_wa='Send via WhatsApp', msg_label='Message',
        book_title='Book a Visit', book_h='Pick a time that suits you',
        book_p="Choose a day and time inside my hours and I'll confirm by message. Nothing is booked until I reply.",
        b_day='Day', b_time='Time', b_type='Type', b_area='Area', b_problem='Problem', b_name='Name',
        b_types=['Home or office visit', 'Remote session', 'Pick-up &amp; return'], b_other='Other / remote',
        b_problem_ph='e.g. laptop very slow since an update', b_name_ph='Your name',
        b_send='Request via WhatsApp', b_email='Request via Email',
        reviews_none='No reviews yet', review_btn='Leave a review',
        review_text="Hi! I'd like to leave a review for Yuwri: ",
        wa_text='Hi%21%20I%20found%20your%20site%20and%20I%27d%20like%20some%20help%20with%20my%20computer.',
        footer=[('#services', 'Services'), ('#about', 'About'), ('#contact', 'Contact')],
        nav_js='js/nav.js',
    ),
    'pt': dict(
        lang='pt-PT', home_prefix='', assets='../',
        ids=dict(services='servicos', about='sobre', contact='contacto', area='zona', testimonials='testemunhos', approach='abordagem', book='marcar'),
        nav=[('#servicos', 'Serviços'), ('prices/', 'Preços'), ('software/', 'Software'), ('blog/', 'Dicas'),
             ('resources/', 'Recursos'), ('#sobre', 'Sobre'), ('#contacto', 'Contactos')],
        lang_switch=('../', 'en', 'EN'), cta='Contacte-me', menu_label='Menu',
        desk=[('#servicos', 'services', 'Serviços'), ('prices/', 'prices', 'Preços'), ('#marcar', 'book', 'Marcar Visita'), ('software/', 'software', 'Software'),
              ('blog/', 'tips', 'Dicas'), ('#ferramentas', 'tools', 'Extras'), ('#contacto', 'contact', 'Contactos')],
        welcome_title='Bem-vindo',
        kicker='Bem-vindo à <strong>Yuwri</strong> &middot; Suporte informático no Seixal',
        h1='<span class="accent">Reparação</span> de Computadores',
        tip_head='Sabia que&hellip;',
        tagline='Se o seu computador está lento, não funciona bem, ou simplesmente não liga, fale comigo.',
        checks=['Visitas presenciais', 'Sessões remotas', 'Levo e devolvo'],
        actions=[('#contacto', 'Contacte-me', True), ('#servicos', 'Os Meus Serviços', False), ('prices/', 'Ver Preços', False), ('#ferramentas', 'Extras Gratuitos', False)],
        welcome_foot='Reparações &middot; Montagem de PC &middot; Remoção de vírus &middot; Instalações &middot; Sites',
        services_title='Os Meus Serviços', menu_items=['Ficheiro', 'Editar', 'Ver', 'Ajuda'], address='Endereço',
        address_path='C:\\Yuwri\\Servicos',
        services=[
            ('gear', 'Reparação de Computadores', 'O seu computador não funciona bem? Diagnostico o problema e ponho-o a funcionar rapidamente.', 'Contacte-me'),
            ('code', 'Criação e Manutenção de Sites', 'Um site limpo e rápido, pensado para aquilo que o seu negócio precisa, com atualizações contínuas para continuar a funcionar bem depois do lançamento.', 'Contacte-me'),
            ('chip', 'Montagem de PC', 'Um PC à medida das suas necessidades e do seu orçamento.', None),
            ('shield', 'Remoção de Vírus', 'Livre-se de vírus ou malware que estão a tornar o seu computador lento.', None),
            ('download', 'Instalação de Programas', 'Programas instalados em segurança, e configurados corretamente à primeira.', None),
            ('refresh', 'Formatação / Instalação de SO', 'Uma formatação nova, ou um sistema operativo completamente novo.', None),
        ],
        objects='6 itens', see_prices='Ver preços &rarr;',
        area_title='Onde Trabalho', area_intro='Visitas a casa e ao escritório, e levantamento e entrega, em:',
        remote='Sessões remotas em qualquer ponto de Portugal.',
        hours_title='Quando',
        hours=[('Segunda a sexta', '18:00–22:00'), ('Sábado e domingo', '10:00–20:00')],
        hours_note='Pode enviar mensagem fora deste horário. Respondo assim que puder.',
        prices_btn='Ver Preços',
        sw_title='Instalação de Software', sw_h='Não sabe o que instalar?',
        sw_p='Aqui está o antivírus, VPN, backup e software de limpeza que eu próprio uso e recomendo aos meus clientes.',
        sw_progress='A escolher o que presta&hellip;', sw_btn='Ver as minhas recomendações &gt;',
        tools_title='Alguns Extras Gratuitos',
        tools_p='Quer me contrate ou não: um assistente de diagnóstico, um teste de reparar-ou-substituir, checklists imprimíveis, um glossário em linguagem simples, e um quadro para tudo o que vale a pena assinalar agora.',
        tools=[('troubleshoot/', 'help', 'Assistente de Diagnóstico'), ('repair-or-replace/', 'pc', 'Reparar ou Substituir?'),
               ('cheat-sheets/', 'checklist', 'Checklists'), ('glossary/', 'glossary', 'Glossário'), ('heads-up/', 'warning', 'Avisos')],
        about_title='Sobre Mim', tabs=['Geral', 'Serviços', 'Horário'],
        sys=[('Sistema:', 'Yuwri Suporte Informático'), ('Localização:', 'Seixal, Portugal'), ('Desde:', '2023')],
        about_p='A Yuwri não é apenas um nome de empresa. Sou o seu parceiro de confiança na resolução rápida e eficiente de todos os problemas do seu computador. Comecei por paixão pela tecnologia e um compromisso com um serviço de excelência, e tenho o orgulho de servir particulares e empresas no Seixal desde 2023.',
        approach_file='leiame.txt', approach_menu=['Ficheiro', 'Editar', 'Pesquisar', 'Ajuda'],
        approach_h='Abordagem Personalizada',
        approach_p='O que me distingue é a minha abordagem personalizada às soluções informáticas. Acredito em construir relações, não apenas em reparar computadores. Ao escolher a Yuwri, está a escolher um técnico simpático e experiente, que ouve as suas preocupações, compreende as suas necessidades e cria soluções à medida dos seus objetivos.',
        approach_tags=['Um técnico simpático e experiente', 'Soluções à medida dos seus objetivos', 'Relações verdadeiras, não apenas tickets'],
        testi_title='O Que Dizem os Clientes', testi_h='Novo por aqui, sem enrolar.',
        testi_p='Ainda não montei uma forma de recolher opiniões no site, por isso não há nada para mostrar aqui além de espaço em branco. Prefiro isso a inventar algo que não seja real. Se quiser ouvir de alguém que já ajudei, basta perguntar quando entrar em contacto.',
        testi_btn='Entrar em contacto',
        contact_title='Nova Mensagem', send='Enviar', call='Ligar', whatsapp='WhatsApp',
        f_to='Para:', f_phone='Telefone:', f_chat='Chat:', f_from='De:', f_subject='Assunto:',
        from_ph='O seu nome', subject_ph='O que se passa?', msg_ph='Diga-me qual é o problema, que computador tem, e quando lhe dá jeito…',
        contact_h='Vamos falar.',
        contact_p='Tenho todo o gosto em ouvi-lo. Escreva aqui a sua mensagem e envie por email ou WhatsApp. Respondo normalmente no mesmo dia.',
        contact_quote=('Prefere um formulário?', 'Descreva o problema e peça um orçamento &rarr;'),
        send_btn='Enviar Email', send_wa='Enviar por WhatsApp', msg_label='Mensagem',
        book_title='Marcar Visita', book_h='Escolha a hora que lhe dá jeito',
        book_p='Escolha um dia e hora dentro do meu horário e eu confirmo por mensagem. Nada fica marcado até eu responder.',
        b_day='Dia', b_time='Hora', b_type='Tipo', b_area='Zona', b_problem='Problema', b_name='Nome',
        b_types=['Visita a casa ou escritório', 'Sessão remota', 'Levo e devolvo'], b_other='Outra / remoto',
        b_problem_ph='ex.: portátil muito lento desde uma atualização', b_name_ph='O seu nome',
        b_send='Pedir por WhatsApp', b_email='Pedir por Email',
        reviews_none='Ainda sem opiniões', review_btn='Deixar uma opinião',
        review_text='Olá! Gostava de deixar uma opinião sobre a Yuwri: ',
        wa_text='Ol%C3%A1%21%20Encontrei%20o%20seu%20site%20e%20gostava%20de%20ajuda%20com%20o%20meu%20computador.',
        footer=[('#servicos', 'Serviços'), ('#sobre', 'Sobre'), ('#contacto', 'Contactos')],
        nav_js='../js/nav.js',
    ),
}

TOWNS = ['Seixal', 'Amora', 'Corroios', 'Fernão Ferro', 'Arrentela', 'Paio Pires', 'Almada', 'Barreiro', 'Moita']
EMAIL = 'yuwrim4il@pm.me'
PHONE_HREF = 'tel:+351924129893'
PHONE = '+351 924 129 893'


def body(t):
    i = t['ids']
    tools_id = 'tools' if t['lang'] == 'en' else 'ferramentas'
    wa = f"https://wa.me/351924129893?text={t['wa_text']}"
    L = []
    a = L.append
    a('<body class="home">\n\n  <div id="top">\n')
    # Taskbar
    a('    <!-- Taskbar -->\n    <header class="wrap">\n      <nav class="site-nav">\n')
    a('        <a class="brand" href="#top">\n          <span class="brand-mark">Y</span>\n          <span class="brand-name">Yuwri</span>\n        </a>\n')
    a('        <div class="nav-links" id="nav-links">\n')
    for href, label in t['nav']:
        a(f'          <a href="{href}">{label}</a>\n')
    a('        </div>\n')
    a(f'        <button type="button" class="nav-toggle" aria-label="{t["menu_label"]}" aria-expanded="false" aria-controls="nav-links">\n'
      '          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><path d="M4 6h16M4 12h16M4 18h16"/></svg>\n'
      '        </button>\n')
    lh, ll, lt = t['lang_switch']
    a(f'        <div class="nav-actions">\n          <a href="{lh}" class="lang-switch mono" lang="{ll}" hreflang="{ll}">{lt}</a>\n'
      f'          <a href="#{i["contact"]}" class="btn btn-primary btn-sm">{t["cta"]}</a>\n        </div>\n')
    a('      </nav>\n    </header>\n\n')

    a('    <main class="desktop">\n\n')
    # Desktop icons
    a('      <!-- Desktop icons -->\n      <ul class="desk-icons">\n')
    for href, icon, label in t['desk']:
        a(f'        <li><a class="desk-icon" href="{href}">{px(icon, 40)}<span>{label}</span></a></li>\n')
    a('      </ul>\n\n      <div class="windows">\n\n')

    # Welcome
    a(f'        <!-- Welcome -->\n        <section id="welcome" class="win" aria-labelledby="welcome-title">\n'
      f'          <div class="win-title">{px("logo", 16)}<span class="win-title-text">{t["welcome_title"]}</span>{controls()}</div>\n'
      '          <div class="welcome">\n            <div>\n'
      f'              <p class="welcome-kicker">{t["kicker"]}</p>\n'
      f'              <h1 class="welcome-title" id="welcome-title">{t["h1"]}</h1>\n'
      f'              <div class="field tip">\n                {px("bulb", 40)}\n                <div>\n'
      f'                  <p class="tip-head">{t["tip_head"]}</p>\n                  <p>{t["tagline"]}</p>\n                </div>\n              </div>\n'
      '              <ul class="checklist">\n')
    for c in t['checks']:
        a(f'                <li>{px("p-check", 18)}{c}</li>\n')
    a('              </ul>\n            </div>\n            <div class="welcome-actions">\n')
    for href, label, primary in t['actions']:
        cls = 'btn btn-primary' if primary else 'btn'
        a(f'              <a href="{href}" class="{cls}">{label}</a>\n')
    a(f'            </div>\n            <p class="welcome-foot">{px("p-wrench", 16)}{t["welcome_foot"]}</p>\n          </div>\n        </section>\n\n')

    # Services
    a(f'        <!-- Services -->\n        <section id="{i["services"]}" class="win" aria-labelledby="services-title">\n'
      f'          {title("services", t["services_title"], id_="services-title")}\n'
      '          <ul class="icon-view field">\n')
    for icon, name, desc, cta in t['services']:
        link = f'\n                <a href="#{i["contact"]}">{cta} &rarr;</a>' if cta else ''
        a(f'            <li class="icon-item">\n              {px(icon, 40)}\n              <div>\n'
          f'                <h3>{name}</h3>\n                <p>{desc}</p>{link}\n              </div>\n            </li>\n')
    a(f'          </ul>\n          <div class="win-status"><span>{t["objects"]}</span><a href="prices/">{t["see_prices"]}</a></div>\n        </section>\n\n')

    # Area + hours
    a('        <div class="win-row">\n')
    a(f'          <!-- Where -->\n          <section id="{i["area"]}" class="win" aria-labelledby="area-title">\n'
      f'            {title("globe", t["area_title"], id_="area-title")}\n'
      f'            <div class="win-body">\n              <p class="win-copy">{t["area_intro"]}</p>\n'
      '              <ul class="town-list field">\n')
    for town in TOWNS:
        a(f'                <li>{px("p-pin", 16)}{town}</li>\n')
    a(f'              </ul>\n              <p class="note">{px("p-globe", 16)}{t["remote"]}</p>\n            </div>\n          </section>\n\n')
    a(f'          <!-- When -->\n          <section id="hours" class="win" aria-labelledby="hours-title">\n'
      f'            {title("clock", t["hours_title"], id_="hours-title")}\n'
      f'            <div class="win-body">\n              <div class="hours-panel">\n                {px("clock", 64)}\n'
      '                <dl class="hours-list field">\n')
    for d, h in t['hours']:
        a(f'                  <div><dt>{d}</dt><dd>{h}</dd></div>\n')
    a(f'                </dl>\n              </div>\n              <p class="note">{t["hours_note"]}</p>\n'
      f'              <div class="win-actions"><a href="prices/" class="btn">{t["prices_btn"]}</a></div>\n            </div>\n          </section>\n')
    a('        </div>\n\n')

    # Software + tools
    a('        <div class="win-row">\n')
    a(f'          <!-- Software -->\n          <section id="setup" class="win" aria-labelledby="software-title">\n'
      f'            {title("software", t["sw_title"])}\n'
      f'            <div class="installer">\n              <div class="installer-side">{px("software", 72)}</div>\n'
      f'              <div class="installer-main">\n                <h3 id="software-title">{t["sw_h"]}</h3>\n'
      f'                <p class="win-copy">{t["sw_p"]}</p>\n'
      f'                <div class="progress" aria-hidden="true"><div class="progress-fill"></div></div>\n'
      f'                <p class="progress-label" aria-hidden="true">{t["sw_progress"]}</p>\n'
      f'                <div class="win-actions"><a href="software/" class="btn btn-primary">{t["sw_btn"]}</a></div>\n'
      '              </div>\n            </div>\n          </section>\n\n')
    a(f'          <!-- Free tools -->\n          <section id="{tools_id}" class="win" aria-labelledby="tools-title">\n'
      f'            {title("tools", t["tools_title"], id_="tools-title")}\n'
      f'            <div class="win-body">\n              <p class="win-copy">{t["tools_p"]}</p>\n'
      '              <ul class="program-grid field">\n')
    for href, icon, label in t['tools']:
        a(f'                <li><a class="program" href="{href}">{px(icon, 40)}<span>{label}</span></a></li>\n')
    a('              </ul>\n            </div>\n          </section>\n        </div>\n\n')

    # About + approach
    a('        <div class="win-row">\n')
    a(f'          <!-- About -->\n          <section id="{i["about"]}" class="win" aria-labelledby="about-title">\n'
      f'            {title("user", t["about_title"], id_="about-title")}\n'
      '            <div class="tabs" aria-hidden="true">')
    for n, tab in enumerate(t['tabs']):
        active = ' class="is-active"' if n == 0 else ''
        a(f'<span{active}>{tab}</span>')
    a('</div>\n            <div class="tab-panel">\n              <div class="sysinfo">\n'
      f'                {px("logo", 80)}\n                <div>\n                  <dl>\n')
    for dt, dd in t['sys']:
        a(f'                    <dt>{dt}</dt><dd>{dd}</dd>\n')
    a(f'                  </dl>\n                  <p>{t["about_p"]}</p>\n                </div>\n              </div>\n            </div>\n          </section>\n\n')
    a(f'          <!-- Approach -->\n          <section id="{i["approach"]}" class="win" aria-labelledby="approach-title">\n'
      f'            {title("note", t["approach_file"])}\n'
      f'            <div class="notepad">\n              <h3 id="approach-title">{t["approach_h"]}</h3>\n'
      f'              <p>{t["approach_p"]}</p>\n              <ul>\n')
    for tag in t['approach_tags']:
        a(f'                <li>{tag}</li>\n')
    a('              </ul>\n            </div>\n          </section>\n        </div>\n\n')

    # Reviews (fill REVIEWS with real quotes; until then an honest empty state)
    review_wa = f"https://wa.me/351924129893?text={quote(t['review_text'])}"
    a(f'        <!-- Reviews -->\n        <section id="{i["testimonials"]}" class="win" aria-labelledby="testimonials-title">\n'
      f'          {title("reviews", t["testi_title"], id_="testimonials-title")}\n'
      '          <div class="win-body">\n')
    reviews = REVIEWS.get(t['lang'][:2], [])
    if reviews:
        a('            <ul class="review-list">\n')
        for r in reviews:
            stars = '&#9733;' * r['stars'] + '<span class="star-off">' + '&#9733;' * (5 - r['stars']) + '</span>'
            a(f'              <li class="review"><div class="stars" aria-label="{r["stars"]}/5">{stars}</div>'
              f'<blockquote>{r["text"]}</blockquote><p class="review-by">{r["name"]} &middot; {r["town"]}</p></li>\n')
        a('            </ul>\n')
    else:
        a(f'            <div class="msgbox">\n              {px("reviews", 52)}\n              <div>\n'
          f'                <div class="stars stars-empty" aria-label="{t["reviews_none"]}">&#9733;&#9733;&#9733;&#9733;&#9733;</div>\n'
          f'                <h3>{t["testi_h"]}</h3>\n                <p>{t["testi_p"]}</p>\n              </div>\n            </div>\n')
    a(f'            <div class="win-actions"><a href="{review_wa}" class="btn" target="_blank" rel="noopener">{t["review_btn"]}</a>'
      f'<a href="#{i["contact"]}" class="btn btn-primary">{t["testi_btn"]}</a></div>\n'
      '          </div>\n        </section>\n\n')

    # Book a visit
    a(f'        <!-- Book a visit -->\n        <section id="{i["book"]}" class="win" aria-labelledby="book-title">\n'
      f'          {title("book", t["book_title"])}\n'
      '          <div class="win-body">\n'
      f'            <h3 class="form-head" id="book-title">{t["book_h"]}</h3>\n            <p class="win-copy">{t["book_p"]}</p>\n'
      f'            <form class="book-form form-grid" action="mailto:{EMAIL}" method="get" data-wa="351924129893" data-email="{EMAIL}">\n'
      f'              <label for="book-day-{t["lang"][:2]}">{t["b_day"]}</label><input id="book-day-{t["lang"][:2]}" type="date" name="day" required>\n'
      f'              <label for="book-time-{t["lang"][:2]}">{t["b_time"]}</label><select id="book-time-{t["lang"][:2]}" name="time" required>'
      + ''.join(f'<option>{h:02d}:00</option>' for h in range(10, 22)) + '</select>\n'
      f'              <label for="book-type-{t["lang"][:2]}">{t["b_type"]}</label><select id="book-type-{t["lang"][:2]}" name="type">'
      + ''.join(f'<option>{x}</option>' for x in t['b_types']) + '</select>\n'
      f'              <label for="book-area-{t["lang"][:2]}">{t["b_area"]}</label><select id="book-area-{t["lang"][:2]}" name="area">'
      + ''.join(f'<option>{x}</option>' for x in TOWNS) + f'<option>{t["b_other"]}</option></select>\n'
      f'              <label for="book-problem-{t["lang"][:2]}">{t["b_problem"]}</label><textarea id="book-problem-{t["lang"][:2]}" name="problem" rows="3" placeholder="{t["b_problem_ph"]}" required></textarea>\n'
      f'              <label for="book-name-{t["lang"][:2]}">{t["b_name"]}</label><input id="book-name-{t["lang"][:2]}" type="text" name="name" autocomplete="name" placeholder="{t["b_name_ph"]}" required>\n'
      f'              <div class="form-actions"><button type="submit" class="btn" data-via="email">{t["b_email"]}</button>'
      f'<button type="submit" class="btn btn-primary" data-via="whatsapp">{t["b_send"]}</button></div>\n'
      '            </form>\n          </div>\n        </section>\n\n')

    # Contact: a working New Message window
    a(f'        <!-- Contact -->\n        <section id="{i["contact"]}" class="win" aria-labelledby="contact-title">\n'
      f'          <div class="win-title">{px("contact", 16)}<h2 class="win-title-text" id="contact-title">{t["contact_title"]}</h2>{controls()}</div>\n'
      f'          <form class="mail-form" action="mailto:{EMAIL}" method="get" data-wa="351924129893" data-email="{EMAIL}">\n'
      '          <div class="toolbar">\n'
      f'            <button type="submit" class="tool-btn" data-via="email">{px("send", 30)}{t["send"]}</button>\n'
      f'            <a class="tool-btn" href="{PHONE_HREF}">{px("phone", 30)}{t["call"]}</a>\n'
      f'            <a class="tool-btn" href="{wa}" target="_blank" rel="noopener">{px("chat", 30)}{t["whatsapp"]}</a>\n'
      '          </div>\n          <div class="mail-fields">\n'
      f'            <span>{t["f_to"]}</span><a href="mailto:{EMAIL}">{px("p-mail", 16)}{EMAIL}</a>\n'
      f'            <label for="mail-from-{t["lang"][:2]}">{t["f_from"]}</label><input id="mail-from-{t["lang"][:2]}" type="text" name="name" autocomplete="name" placeholder="{t["from_ph"]}">\n'
      f'            <label for="mail-subject-{t["lang"][:2]}">{t["f_subject"]}</label><input id="mail-subject-{t["lang"][:2]}" type="text" name="subject" placeholder="{t["subject_ph"]}">\n'
      f'            <span>{t["f_phone"]}</span><a href="{PHONE_HREF}">{px("p-phone", 16)}{PHONE}</a>\n'
      '          </div>\n          <div class="mail-body">\n'
      f'            <h3>{t["contact_h"]}</h3>\n            <p>{t["contact_p"]}</p>\n'
      f'            <p class="quote-link">{t["contact_quote"][0]} <a href="quote/">{t["contact_quote"][1]}</a></p>\n'
      f'            <label class="sr-only" for="mail-body-{t["lang"][:2]}">{t["msg_label"]}</label>'
      f'<textarea id="mail-body-{t["lang"][:2]}" name="body" rows="6" placeholder="{t["msg_ph"]}" required></textarea>\n'
      f'            <div class="form-actions"><button type="submit" class="btn" data-via="whatsapp">{t["send_wa"]}</button>'
      f'<button type="submit" class="btn btn-primary" data-via="email">{t["send_btn"]}</button></div>\n'
      '          </div>\n          </form>\n        </section>\n\n'.replace('</div>\n          </form>', '</div>\n          </form>'))

    a('      </div>\n    </main>\n\n')
    a('    <div class="icon-bank" hidden>' + ''.join(px(n, 16) for n in COLORS) + '</div>\n\n')
    # Footer
    a('    <!-- Footer -->\n    <footer class="site-footer">\n      <div class="wrap footer-row">\n'
      '        <div class="footer-copy mono">&copy; 2026 Yuwri &middot; Seixal, Portugal</div>\n        <div class="footer-links">\n')
    for href, label in t['footer']:
        a(f'          <a href="{href}">{label}</a>\n')
    a('        </div>\n      </div>\n    </footer>\n\n  </div>\n\n')
    a(f'<script src="{t["nav_js"]}"></script>\n<script src="{t["nav_js"].replace("nav.js", "desktop.js")}"></script>\n<script src="{t["nav_js"].replace("nav.js", "forms.js")}"></script>\n\n</body>')
    return ''.join(L)


WIDTHS = {
    'welcome': 740, 'services': 840, 'servicos': 840, 'area': 520, 'zona': 520, 'hours': 480,
    'setup': 580, 'tools': 540, 'ferramentas': 540, 'about': 620, 'sobre': 620,
    'approach': 560, 'abordagem': 560, 'testimonials': 580, 'testemunhos': 580,
    'contact': 640, 'contacto': 640, 'book': 600, 'marcar': 600,
}

# Real client reviews go here, e.g.
# {'name': 'Maria', 'town': 'Amora', 'stars': 5, 'text': 'Fixed my laptop the same day.'}
REVIEWS = {'en': [], 'pt': []}


def windowize(html):
    def fix(m):
        open_tag, inner, close = m.group(1), m.group(2), m.group(3)
        wid = re.search(r'id="([^"]+)"', open_tag).group(1)
        open_tag = open_tag.replace('class="win"', f'class="win" data-w="{WIDTHS[wid]}"')
        tm = re.search(r'<div class="win-title">.*?<span>\+</span></div></div>', inner)
        assert tm, wid
        inner = inner[:tm.end()] + '\n          <div class="win-content">' + inner[tm.end():] + '\n          </div>'
        return open_tag + inner + close
    out, n = re.subn(r'(<section id="[^"]+" class="win"[^>]*>)(.*?)(\s*</section>)', fix, html, flags=re.S)
    assert n == 11, n
    return out


def main():
    for lang, path in (('en', 'index.html'), ('pt', 'pt/index.html')):
        src = open(path, encoding='utf-8').read()
        new, n = re.subn(r'<body[^>]*>.*</body>', lambda m: windowize(body(T[lang])), src, flags=re.S)
        assert n == 1, path
        open(path, 'w', encoding='utf-8').write(new)
    open('images/favicon.svg', 'w').write(favicon())
    print('ok')


if __name__ == '__main__':
    main()
