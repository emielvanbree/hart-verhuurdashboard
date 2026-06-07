const path = require('path');
const fs = require('fs');

const PDF_DIR = path.join(__dirname, '..', '..', 'pdfs');
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });

const LOGO_PATH = path.join(__dirname, '..', '..', 'pdfs', 'assets', 'logo.jpg');

function getLogoBase64() {
  try {
    const data = fs.readFileSync(LOGO_PATH);
    return `data:image/jpeg;base64,${data.toString('base64')}`;
  } catch (e) { return null; }
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatEuro(amount) {
  return `€ ${parseFloat(amount || 0).toFixed(2).replace('.', ',')}`;
}

function nl2br(str) {
  return (str || '').replace(/\n/g, '<br>');
}

function buildPdfHtml({ title, subtitle, client, practiceName, practiceEmail, practiceAddress, practicePhone, practiceIban, practiceKvk, footerNote, logoBase64, sections, refNumber }) {
  const logo = logoBase64 || getLogoBase64();
  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;600;700;800&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Nunito Sans', 'Helvetica Neue', Arial, sans-serif; color:#1a1a1a; background:#fff; font-size:13px; line-height:1.55; }
  .page { padding: 36px 44px; max-width: 800px; margin: 0 auto; }

  /* Header — briefhoofd stijl */
  .doc-header { margin-bottom:20px; }
  .practice-logo { height:72px; max-width:320px; object-fit:contain; object-position:left; display:block; margin-bottom:14px; }
  .doc-title { font-size:26px; font-weight:800; color:#237062; text-transform:uppercase; letter-spacing:0.05em; line-height:1.1; margin-bottom:16px; }
  .doc-divider { border:none; border-top:4px solid #237062; margin-bottom:20px; }

  /* Reference bar */
  .ref-bar { background:#f0f7f5; border-left:4px solid #237062; padding:8px 14px; margin-bottom:22px; display:flex; gap:24px; flex-wrap:wrap; font-size:11px; color:#555; border-radius:0 4px 4px 0; }
  .ref-bar strong { color:#237062; }

  /* Section */
  .section { margin-bottom:22px; }
  .section-title { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; color:#9A1B85; margin-bottom:8px; padding-bottom:5px; border-bottom:1.5px solid #f0e8f5; }

  /* Grid */
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:6px 28px; }
  .grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px 16px; }
  .field { margin-bottom:2px; }
  .field-label { font-size:9.5px; color:#999; text-transform:uppercase; letter-spacing:0.06em; }
  .field-value { font-size:13px; font-weight:700; color:#1a1a1a; }

  /* Table */
  table { width:100%; border-collapse:collapse; margin-top:6px; border-radius:6px; overflow:hidden; }
  thead tr { background:#237062; }
  th { padding:9px 12px; font-size:11px; font-weight:700; color:#fff; text-align:left; }
  td { padding:8px 12px; font-size:12px; border-bottom:1px solid #f0f0f0; }
  tr:nth-child(even) td { background:#f9fdfb; }
  .tr-total td { background:#237062 !important; color:#fff; font-weight:800; font-size:13px; }
  .tr-credit td { background:#9A1B85 !important; color:#fff; font-weight:800; }
  .tr-borg td { background:#f0f7f5; color:#237062; font-style:italic; font-size:11px; }

  /* Text block */
  .text-block { font-size:12px; color:#444; line-height:1.7; background:#fafafa; border-radius:6px; padding:12px 14px; border:1px solid #eee; white-space:pre-line; }

  /* Conditions list */
  .conditions { font-size:11.5px; color:#444; line-height:1.75; padding-left:0; }
  .conditions p { margin-bottom:2px; padding-left:14px; position:relative; }
  .conditions p::before { content:'›'; position:absolute; left:0; color:#9A1B85; font-weight:800; }

  /* Signature */
  .sig-box { border:2px dashed #ccc; border-radius:8px; padding:18px 20px; margin-top:12px; }
  .sig-row { display:flex; gap:40px; align-items:flex-end; margin-top:8px; }
  .sig-field { flex:1; border-bottom:1px solid #ccc; min-height:36px; position:relative; }
  .sig-field-label { font-size:10px; color:#aaa; margin-top:4px; }

  /* Status badge */
  .badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:10.5px; font-weight:700; }
  .badge-ok { background:#d4f0e8; color:#1a7a50; }
  .badge-warn { background:#fff3cd; color:#856404; }
  .badge-bad { background:#fde8ea; color:#9b1c2a; }

  /* Footer */
  .doc-footer { margin-top:36px; padding-top:14px; border-top:1.5px solid #eee; display:flex; justify-content:space-between; align-items:center; font-size:10px; color:#aaa; }
  .doc-footer-note { font-style:italic; }
  .doc-footer-ref { text-align:right; }
</style>
</head>
<body>
<div class="page">

  <div class="doc-header">
    ${logo ? `<img src="${logo}" class="practice-logo" alt="Logo">` : ''}
    <div class="doc-title">${title}</div>
    <hr class="doc-divider">
  </div>

  <div class="ref-bar">
    <span><strong>Datum</strong> ${formatDate(new Date().toISOString())}</span>
    ${refNumber ? `<span><strong>Ref.nr</strong> ${refNumber}</span>` : ''}
    ${client ? `<span><strong>Cliënt</strong> ${client.name}${client.client_number ? ' · ' + client.client_number : ''}</span>` : ''}
  </div>

  ${sections.join('')}

  <div class="doc-footer">
    <div class="doc-footer-note">${footerNote || ''}</div>
    <div class="doc-footer-ref">${practiceName} · ${refNumber || ''} · ${formatDate(new Date().toISOString())}</div>
  </div>

</div>
</body>
</html>`;
}

async function generateAgreementPDF({ client, articles, reservation, settings }) {
  const filename = `overeenkomst_${client.id}_${Date.now()}.pdf`;
  const filePath = path.join(PDF_DIR, filename);

  const totalPrice = articles.reduce((s, a) => s + parseFloat(a.price || 0), 0);
  const totalDeposit = articles.reduce((s, a) => s + parseFloat(a.deposit_amount || 0), 0);

  const articleRows = articles.map(a => `
    <tr>
      <td>${a.name}</td>
      <td>${a.article_type || 'Normaal'}</td>
      <td style="text-align:right">${formatEuro(a.price)}</td>
      <td style="text-align:right">${formatEuro(a.deposit_amount)}</td>
    </tr>`).join('');

  const conditions = (settings.template_agreement_conditions || '')
    .split('\n').filter(Boolean)
    .map(line => `<p>${line}</p>`).join('');

  const sections = [
    `<div class="section">
      <div class="section-title">Klantgegevens</div>
      <div class="grid-2">
        <div class="field"><div class="field-label">Naam</div><div class="field-value">${client.name}</div></div>
        <div class="field"><div class="field-label">Cliëntnummer</div><div class="field-value">${client.client_number || '—'}</div></div>
        <div class="field"><div class="field-label">E-mail</div><div class="field-value">${client.email}</div></div>
        <div class="field"><div class="field-label">Uitgerekende datum</div><div class="field-value">${formatDate(client.due_date)}</div></div>
      </div>
    </div>`,

    settings.template_agreement_intro ? `<div class="section">
      <div class="text-block">${nl2br(settings.template_agreement_intro)}</div>
    </div>` : '',

    `<div class="section">
      <div class="section-title">Geleend materiaal</div>
      <table>
        <thead><tr><th>Artikel</th><th>Type</th><th style="text-align:right">Huurprijs</th><th style="text-align:right">Borg</th></tr></thead>
        <tbody>
          ${articleRows}
          <tr class="tr-total">
            <td colspan="2"><strong>Totaal</strong></td>
            <td style="text-align:right">${formatEuro(totalPrice)}</td>
            <td style="text-align:right">${formatEuro(totalDeposit)}</td>
          </tr>
        </tbody>
      </table>
    </div>`,

    `<div class="section">
      <div class="section-title">Voorwaarden</div>
      <div class="conditions">${conditions || nl2br(settings.template_agreement_conditions || '')}</div>
    </div>`,

    `<div class="section">
      <div class="section-title">Handtekening huurder</div>
      <p style="font-size:12px;color:#555;margin-bottom:12px;">Door te ondertekenen verklaart de huurder de voorwaarden te hebben gelezen en hiermee akkoord te gaan.</p>
      <div class="sig-box">
        <div class="sig-row">
          <div><div class="sig-field"></div><div class="sig-field-label">Naam (drukletters)</div></div>
          <div><div class="sig-field"></div><div class="sig-field-label">Datum</div></div>
        </div>
        <div class="sig-row" style="margin-top:20px;">
          <div style="flex:2"><div class="sig-field"></div><div class="sig-field-label">Handtekening</div></div>
        </div>
      </div>
    </div>`
  ];

  const html = buildPdfHtml({
    title: settings.template_agreement_title || 'Uitleenovereenkomst',
    subtitle: `Bevallingsbad · ${settings.practice_name}`,
    client, practiceName: settings.practice_name,
    practiceEmail: settings.practice_email,
    practiceAddress: settings.practice_address,
    practicePhone: settings.practice_phone,
    practiceIban: settings.practice_iban,
    practiceKvk: settings.practice_kvk,
    footerNote: settings.template_footer,
    refNumber: `RES-${reservation ? reservation.id : '—'}`,
    sections
  });

  await writePDF(html, filePath);
  return { filePath, filename };
}

async function generateInvoicePDF({ client, articles, rental, settings, invoiceNumber }) {
  const filename = `factuur_${client.id}_${rental.id}_${Date.now()}.pdf`;
  const filePath = path.join(PDF_DIR, filename);

  const totalPrice = articles.reduce((s, a) => s + parseFloat(a.price || 0), 0);
  const totalDeposit = articles.reduce((s, a) => s + parseFloat(a.deposit_amount || 0), 0);
  const grandTotal = totalPrice + totalDeposit;

  const rows = articles.map(a => `
    <tr><td>${a.name} (${a.article_type || 'Normaal'})</td><td style="text-align:right">1</td><td style="text-align:right">${formatEuro(a.price)}</td><td style="text-align:right">${formatEuro(a.price)}</td></tr>
    <tr class="tr-borg"><td>↳ Borg ${a.name}</td><td style="text-align:right">1</td><td style="text-align:right">${formatEuro(a.deposit_amount)}</td><td style="text-align:right">${formatEuro(a.deposit_amount)}</td></tr>`).join('');

  const sections = [
    settings.template_invoice_intro ? `<div class="section"><div class="text-block">${nl2br(settings.template_invoice_intro)}</div></div>` : '',
    `<div class="section">
      <div class="section-title">Factuurgegevens</div>
      <div class="grid-3">
        <div class="field"><div class="field-label">Uitleen datum</div><div class="field-value">${formatDate(rental.pickup_date)}</div></div>
        <div class="field"><div class="field-label">Betaalmethode</div><div class="field-value">${rental.payment_method === 'pin' ? 'Pin' : 'Contant'}</div></div>
        <div class="field"><div class="field-label">Verwachte retour</div><div class="field-value">${formatDate(rental.expected_return_date)}</div></div>
      </div>
    </div>`,
    `<div class="section">
      <div class="section-title">Specificatie</div>
      <table>
        <thead><tr><th>Omschrijving</th><th style="text-align:right">Aantal</th><th style="text-align:right">Prijs</th><th style="text-align:right">Totaal</th></tr></thead>
        <tbody>
          ${rows}
          <tr class="tr-total"><td colspan="3"><strong>Totaal te voldoen</strong></td><td style="text-align:right">${formatEuro(grandTotal)}</td></tr>
        </tbody>
      </table>
    </div>`,
    settings.template_invoice_footer ? `<div class="section"><div class="text-block">${nl2br(settings.template_invoice_footer)}</div></div>` : ''
  ];

  const html = buildPdfHtml({
    title: 'Factuur', subtitle: `Huur bevallingsbad · ${settings.practice_name}`,
    client, practiceName: settings.practice_name, practiceEmail: settings.practice_email,
    practiceAddress: settings.practice_address, practicePhone: settings.practice_phone,
    practiceIban: settings.practice_iban, practiceKvk: settings.practice_kvk,
    footerNote: settings.template_footer,
    refNumber: `F-${invoiceNumber || rental.id}`, sections
  });

  await writePDF(html, filePath);
  return { filePath, filename };
}

async function generateCreditNotePDF({ client, rental, creditAmount, settings }) {
  const filename = `creditnota_${client.id}_${rental.id}_${Date.now()}.pdf`;
  const filePath = path.join(PDF_DIR, filename);

  const sections = [
    settings.template_credit_note_intro ? `<div class="section"><div class="text-block">${nl2br(settings.template_credit_note_intro)}</div></div>` : '',
    `<div class="section">
      <div class="section-title">Creditering</div>
      <table>
        <thead><tr><th>Omschrijving</th><th style="text-align:right">Bedrag</th></tr></thead>
        <tbody>
          <tr><td>Terugbetaling borg — ongeopende disposable set</td><td style="text-align:right">${formatEuro(creditAmount)}</td></tr>
          <tr class="tr-credit"><td><strong>Totaal creditering</strong></td><td style="text-align:right"><strong>${formatEuro(creditAmount)}</strong></td></tr>
        </tbody>
      </table>
      <p style="margin-top:12px;font-size:12px;color:#666;">Dit bedrag wordt bij retour contant door de assistent terugbetaald.</p>
    </div>`
  ];

  const html = buildPdfHtml({
    title: 'Creditnota', subtitle: `Retour disposables · ${settings.practice_name}`,
    client, practiceName: settings.practice_name, practiceEmail: settings.practice_email,
    practiceAddress: settings.practice_address, practicePhone: settings.practice_phone,
    practiceIban: settings.practice_iban, footerNote: settings.template_footer,
    refNumber: `CN-${rental.id}`, sections
  });

  await writePDF(html, filePath);
  return { filePath, filename };
}

async function generateExtraInvoicePDF({ client, rental, description, amount, settings }) {
  const filename = `extra_${client.id}_${rental.id}_${Date.now()}.pdf`;
  const filePath = path.join(PDF_DIR, filename);

  const sections = [
    `<div class="section">
      <div class="section-title">Aanvullende kosten</div>
      <table>
        <thead><tr><th>Omschrijving</th><th style="text-align:right">Bedrag</th></tr></thead>
        <tbody>
          <tr><td>${description}</td><td style="text-align:right">${formatEuro(amount)}</td></tr>
          <tr class="tr-total"><td><strong>Totaal</strong></td><td style="text-align:right">${formatEuro(amount)}</td></tr>
        </tbody>
      </table>
    </div>`
  ];

  const html = buildPdfHtml({
    title: 'Extra Factuur', subtitle: `Aanvullende kosten · ${settings.practice_name}`,
    client, practiceName: settings.practice_name, practiceEmail: settings.practice_email,
    practiceAddress: settings.practice_address, practicePhone: settings.practice_phone,
    practiceIban: settings.practice_iban, footerNote: settings.template_footer,
    refNumber: `EF-${rental.id}`, sections
  });

  await writePDF(html, filePath);
  return { filePath, filename };
}

async function writePDF(html, filePath) {
  try {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: 'new' });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({ path: filePath, format: 'A4', margin: { top: '12mm', bottom: '12mm', left: '8mm', right: '8mm' }, printBackground: true });
    await browser.close();
  } catch (e) {
    console.error('Puppeteer unavailable, saving HTML:', e.message);
    const htmlPath = filePath.replace(/\.pdf$/, '.html');
    fs.writeFileSync(htmlPath, html);
    // Write placeholder PDF
    fs.writeFileSync(filePath, Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF'));
    console.log('HTML saved to', htmlPath);
  }
}

module.exports = { generateAgreementPDF, generateInvoicePDF, generateCreditNotePDF, generateExtraInvoicePDF };

async function generateReturnReceiptPDF({ client, rental, articles, settlement, settings }) {
  const filename = `ontvangst_${client.id}_${rental.id}_${Date.now()}.pdf`;
  const filePath = require('path').join(require('path').join(__dirname,'..','..','pdfs'), filename);

  const checkRow = (label, value) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid #f0f0f0;">
      <span style="font-size:13px;color:#444">${label}</span>
      <span style="font-weight:800;font-size:14px;color:${value?'#27ae60':'#e74c3c'}">${value ? '�" Ja' : '�-- Nee'}</span>
    </div>`;

  const articleRows = articles.map(a => `<tr><td>${a.name}</td><td>${a.article_type||'Normaal'}</td><td style="text-align:right">€${parseFloat(a.price).toFixed(2)}</td></tr>`).join('');

  const settlementBlock = settlement ? `
    <div class="section">
      <div class="section-title">Afrekening</div>
      ${settlement.extraCharge > 0 ? `<div style="padding:10px 14px;background:#fde8ea;border-radius:6px;margin-bottom:8px;color:#9b1c2a;font-weight:700">Extra factuur: € ${parseFloat(settlement.extraCharge).toFixed(2).replace('.',',')} — ${settlement.reasons.filter(r=>r!=='Disposables ongeopend retour').join(', ')}</div>` : ''}
      ${settlement.creditNote > 0 ? `<div style="padding:10px 14px;background:#d4f0e8;border-radius:6px;color:#1a7a50;font-weight:700">Creditering: € ${parseFloat(settlement.creditNote).toFixed(2).replace('.',',')} — Disposables ongeopend retour</div>` : ''}
      ${!settlement.extraCharge && !settlement.creditNote ? `<div style="padding:10px 14px;background:#f0f7f5;border-radius:6px;color:#237062">Geen extra kosten — netjes en op tijd teruggebracht.</div>` : ''}
    </div>` : '';

  const html = buildPdfHtml({
    title: 'Ontvangstbevestiging', subtitle: `Retour bevallingsbad · ${settings.practice_name}`,
    client, practiceName: settings.practice_name, practiceEmail: settings.practice_email,
    practiceAddress: settings.practice_address, practicePhone: settings.practice_phone,
    practiceIban: settings.practice_iban, footerNote: settings.template_footer,
    refNumber: `ONT-${rental.id}`,
    sections: [
      `<div class="section">
        <div class="section-title">Retourgegevens</div>
        <div class="grid-3">
          <div class="field"><div class="field-label">Uitleen datum</div><div class="field-value">${formatDate(rental.pickup_date)}</div></div>
          <div class="field"><div class="field-label">Bevalling</div><div class="field-value">${formatDate(rental.birth_date)}</div></div>
          <div class="field"><div class="field-label">Retour datum</div><div class="field-value">${formatDate(rental.return_date)}</div></div>
        </div>
      </div>`,
      `<div class="section">
        <div class="section-title">Geretourneerd materiaal</div>
        <table><thead><tr><th>Artikel</th><th>Type</th><th style="text-align:right">Huurprijs</th></tr></thead>
        <tbody>${articleRows}</tbody></table>
      </div>`,
      `<div class="section">
        <div class="section-title">Retourchecklist</div>
        <div style="border:1px solid #eee;border-radius:8px;overflow:hidden">
          ${checkRow('Set compleet teruggebracht', rental.is_complete_set)}
          ${checkRow('Bad schoon teruggebracht', rental.is_clean)}
          ${checkRow('Disposables ongeopend retour', rental.disposables_unopened)}
        </div>
      </div>`,
      settlementBlock,
      `<div class="section">
        <div class="section-title">Handtekening voor ontvangst</div>
        <div class="sig-box">
          <div class="sig-row">
            <div><div class="sig-field"></div><div class="sig-field-label">Naam medewerker</div></div>
            <div><div class="sig-field"></div><div class="sig-field-label">Datum</div></div>
          </div>
          <div class="sig-row" style="margin-top:20px">
            <div style="flex:2"><div class="sig-field"></div><div class="sig-field-label">Handtekening medewerker</div></div>
          </div>
        </div>
      </div>`
    ]
  });

  await writePDF(html, filePath);
  return { filePath, filename, html };
}

module.exports.generateReturnReceiptPDF = generateReturnReceiptPDF;
