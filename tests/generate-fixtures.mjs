/**
 * Generate test .docx fixtures for Collate.
 *
 * A .docx file is a ZIP archive containing XML files. This script
 * creates realistic test documents with comments, track changes,
 * and various paragraph structures.
 *
 * Usage: node tests/generate-fixtures.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// We'll use the built-in Node.js zlib, but for ZIP we need a library.
// Since we want zero-dependency, we'll write minimal ZIP manually using raw buffers.
// Actually, let's use a simpler approach: write the XML files and use JSZip.

// Minimal ZIP implementation using Node buffers
function createZip(files) {
  const entries = [];
  let offset = 0;
  const localHeaders = [];
  const centralHeaders = [];

  for (const [name, content] of Object.entries(files)) {
    const nameBuffer = Buffer.from(name, 'utf-8');
    const contentBuffer = Buffer.from(content, 'utf-8');

    // Local file header
    const localHeader = Buffer.alloc(30 + nameBuffer.length);
    localHeader.writeUInt32LE(0x04034b50, 0);  // signature
    localHeader.writeUInt16LE(20, 4);           // version needed
    localHeader.writeUInt16LE(0, 6);            // flags
    localHeader.writeUInt16LE(0, 8);            // compression (stored)
    localHeader.writeUInt16LE(0, 10);           // mod time
    localHeader.writeUInt16LE(0, 12);           // mod date
    // CRC-32
    const crc = crc32(contentBuffer);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(contentBuffer.length, 18); // compressed size
    localHeader.writeUInt32LE(contentBuffer.length, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuffer.length, 26);    // filename length
    localHeader.writeUInt16LE(0, 28);                     // extra field length
    nameBuffer.copy(localHeader, 30);

    const localOffset = offset;

    localHeaders.push(Buffer.concat([localHeader, contentBuffer]));
    offset += localHeader.length + contentBuffer.length;

    // Central directory header
    const centralHeader = Buffer.alloc(46 + nameBuffer.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);  // signature
    centralHeader.writeUInt16LE(20, 4);           // version made by
    centralHeader.writeUInt16LE(20, 6);           // version needed
    centralHeader.writeUInt16LE(0, 8);            // flags
    centralHeader.writeUInt16LE(0, 10);           // compression
    centralHeader.writeUInt16LE(0, 12);           // mod time
    centralHeader.writeUInt16LE(0, 14);           // mod date
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(contentBuffer.length, 20);
    centralHeader.writeUInt32LE(contentBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);           // extra field length
    centralHeader.writeUInt16LE(0, 32);           // comment length
    centralHeader.writeUInt16LE(0, 34);           // disk number start
    centralHeader.writeUInt16LE(0, 36);           // internal attributes
    centralHeader.writeUInt32LE(0, 38);           // external attributes
    centralHeader.writeUInt32LE(localOffset, 42); // relative offset
    nameBuffer.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);
  }

  const centralDirOffset = offset;
  const centralDirBuffer = Buffer.concat(centralHeaders);
  const centralDirSize = centralDirBuffer.length;

  // End of central directory
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);                   // signature
  eocd.writeUInt16LE(0, 4);                              // disk number
  eocd.writeUInt16LE(0, 6);                              // disk with central dir
  eocd.writeUInt16LE(centralHeaders.length, 8);          // entries on this disk
  eocd.writeUInt16LE(centralHeaders.length, 10);         // total entries
  eocd.writeUInt32LE(centralDirSize, 12);                // size of central dir
  eocd.writeUInt32LE(centralDirOffset, 16);              // offset of central dir
  eocd.writeUInt16LE(0, 20);                              // comment length

  return Buffer.concat([...localHeaders, centralDirBuffer, eocd]);
}

// CRC-32 implementation
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xEDB88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ─── Content Types ─────────────────────────────────────────────────

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;

const WORD_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>
</Relationships>`;

function makeCoreXml(title) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/"
                   xmlns:dcterms="http://purl.org/dc/terms/">
  <dc:title>${title}</dc:title>
  <dc:creator>Test Author</dc:creator>
  <dcterms:created>2025-01-15T09:00:00Z</dcterms:created>
</cp:coreProperties>`;
}

function makeDocx(title, documentXml, commentsXml) {
  const files = {
    '[Content_Types].xml': CONTENT_TYPES,
    '_rels/.rels': RELS,
    'word/_rels/document.xml.rels': WORD_RELS,
    'word/document.xml': documentXml,
    'docProps/core.xml': makeCoreXml(title),
  };
  if (commentsXml) {
    files['word/comments.xml'] = commentsXml;
  }
  return createZip(files);
}

// ─── Helper: Build paragraph XML ───────────────────────────────────

function p(text) {
  return `<w:p><w:r><w:t xml:space="preserve">${escXml(text)}</w:t></w:r></w:p>`;
}

function pWithDeletion(before, deleted, after, author, id, date) {
  return `<w:p>
  <w:r><w:t xml:space="preserve">${escXml(before)}</w:t></w:r>
  <w:del w:id="${id}" w:author="${escXml(author)}" w:date="${date}">
    <w:r><w:delText xml:space="preserve">${escXml(deleted)}</w:delText></w:r>
  </w:del>
  <w:r><w:t xml:space="preserve">${escXml(after)}</w:t></w:r>
</w:p>`;
}

function pWithInsertion(before, inserted, after, author, id, date) {
  return `<w:p>
  <w:r><w:t xml:space="preserve">${escXml(before)}</w:t></w:r>
  <w:ins w:id="${id}" w:author="${escXml(author)}" w:date="${date}">
    <w:r><w:t xml:space="preserve">${escXml(inserted)}</w:t></w:r>
  </w:ins>
  <w:r><w:t xml:space="preserve">${escXml(after)}</w:t></w:r>
</w:p>`;
}

function pWithSubstitution(before, deleted, inserted, after, author, delId, insId, date) {
  return `<w:p>
  <w:r><w:t xml:space="preserve">${escXml(before)}</w:t></w:r>
  <w:del w:id="${delId}" w:author="${escXml(author)}" w:date="${date}">
    <w:r><w:delText xml:space="preserve">${escXml(deleted)}</w:delText></w:r>
  </w:del>
  <w:ins w:id="${insId}" w:author="${escXml(author)}" w:date="${date}">
    <w:r><w:t xml:space="preserve">${escXml(inserted)}</w:t></w:r>
  </w:ins>
  <w:r><w:t xml:space="preserve">${escXml(after)}</w:t></w:r>
</w:p>`;
}

function pWithComment(text, commentId) {
  const words = text.split(' ');
  const mid = Math.floor(words.length / 2);
  const anchorWords = words.slice(mid - 1, mid + 2).join(' ');
  const beforeAnchor = words.slice(0, mid - 1).join(' ') + ' ';
  const afterAnchor = ' ' + words.slice(mid + 2).join(' ');

  return `<w:p>
  <w:r><w:t xml:space="preserve">${escXml(beforeAnchor)}</w:t></w:r>
  <w:commentRangeStart w:id="${commentId}"/>
  <w:r><w:t xml:space="preserve">${escXml(anchorWords)}</w:t></w:r>
  <w:commentRangeEnd w:id="${commentId}"/>
  <w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="${commentId}"/></w:r>
  <w:r><w:t xml:space="preserve">${escXml(afterAnchor)}</w:t></w:r>
</w:p>`;
}

function wrapDocument(bodyXml) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
${bodyXml}
  </w:body>
</w:document>`;
}

function makeCommentsXml(comments) {
  const commentElements = comments.map(c =>
    `<w:comment w:id="${c.id}" w:author="${escXml(c.author)}" w:date="${c.date}"${c.initials ? ` w:initials="${escXml(c.initials)}"` : ''}>
      <w:p><w:r><w:t>${escXml(c.text)}</w:t></w:r></w:p>
    </w:comment>`
  ).join('\n    ');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    ${commentElements}
</w:comments>`;
}

function escXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── FIXTURE 1: Senior Counsel's Markup ────────────────────────────

function fixture1_seniorCounsel() {
  const body = [
    p('SKELETON ARGUMENT ON BEHALF OF THE CLAIMANT'),
    p('IN THE HIGH COURT OF JUSTICE'),
    p('BUSINESS AND PROPERTY COURTS OF ENGLAND AND WALES'),
    p('COMMERCIAL COURT (QBD)'),
    p('Claim No. CL-2025-000142'),
    p('BETWEEN:'),
    p('MERIDIAN CAPITAL PARTNERS LLP (Claimant)'),
    p('— and —'),
    p('ATLAS INFRASTRUCTURE GROUP PLC (Defendant)'),
    p('INTRODUCTION'),
    pWithComment(
      'This skeleton argument is filed on behalf of the Claimant in support of its application for summary judgment pursuant to CPR Part 24.',
      '1'
    ),
    pWithSubstitution(
      'The Claimant submits that ',
      'the loss was caused by',
      'causation is established by reference to',
      ' the Defendant\'s breach of the Investment Management Agreement dated 15 March 2023.',
      'Senior Counsel',
      '10', '11',
      '2025-02-10T14:00:00Z'
    ),
    p('The claim arises from the Defendant\'s systematic failure to maintain adequate risk controls in relation to the Emerging Markets Portfolio, resulting in losses of approximately £4.2 million.'),
    pWithDeletion(
      'The Defendant had ',
      'absolutely ',
      'no reasonable basis for allowing the concentrated position in Andean Mining Corp to exceed the 15% sector limit imposed by the IMA.',
      'Senior Counsel',
      '12',
      '2025-02-10T14:05:00Z'
    ),
    p('FACTUAL BACKGROUND'),
    pWithComment(
      'By the IMA, the Defendant was appointed as discretionary investment manager of the Claimant\'s Emerging Markets Portfolio with an initial value of approximately £28 million.',
      '2'
    ),
    pWithInsertion(
      'The IMA contained express risk limits including ',
      'a maximum 15% allocation to any single sector and a maximum 5% allocation to any single issuer, ',
      'which the Defendant acknowledged in correspondence dated 22 March 2023.',
      'Senior Counsel',
      '13',
      '2025-02-10T14:15:00Z'
    ),
    p('Between September and November 2024, the Defendant increased the Portfolio\'s exposure to Andean Mining Corp from 3.2% to 22.7%, in clear breach of the IMA limits.'),
    pWithSubstitution(
      'The Defendant failed to notify the Claimant of this breach ',
      'despite multiple opportunities to do so',
      'until the position had already crystallised significant losses',
      ', contrary to clause 8.4 of the IMA which required immediate notification of any limit breach.',
      'Senior Counsel',
      '14', '15',
      '2025-02-10T14:20:00Z'
    ),
    p('LEGAL FRAMEWORK'),
    p('The applicable legal principles are well established. An investment manager owes contractual duties to manage a portfolio within the agreed risk parameters: Gestmin SGPS SA v Credit Suisse (UK) Ltd [2013] EWHC 3560 (Comm).'),
    pWithComment(
      'Where a manager exceeds agreed limits without authorisation, the manager is in breach regardless of whether the investment would have been profitable: Rubenstein v HSBC Bank plc [2012] EWCA Civ 1184.',
      '3'
    ),
    p('The standard of care required is that of a reasonably competent investment manager: Spreadex Ltd v Sekhon [2008] EWHC 1136 (Ch).'),
    p('CAUSATION AND LOSS'),
    pWithSubstitution(
      'The Claimant\'s loss is the difference between the value of the Portfolio ',
      'as it should have been managed',
      'had it been managed in compliance with the IMA limits',
      ' and its actual value as at the date of discovery of the breach.',
      'Senior Counsel',
      '16', '17',
      '2025-02-10T15:00:00Z'
    ),
    pWithComment(
      'Expert evidence from Dr Sarah Chen of Quantitative Risk Associates confirms that a compliant portfolio would have returned approximately 6.8% over the relevant period, compared to the actual loss of 14.2%.',
      '4'
    ),
    p('The total loss claimed is £4,186,340, being the aggregate of the excess position loss of £3,847,200 and consequential portfolio rebalancing costs of £339,140.'),
    p('RELIEF SOUGHT'),
    p('The Claimant seeks summary judgment for damages in the sum of £4,186,340 together with interest pursuant to section 35A of the Senior Courts Act 1981 and costs.'),
  ].join('\n');

  const comments = [
    { id: '1', author: 'Senior Counsel', date: '2025-02-10T13:30:00Z', initials: 'SC', text: 'Consider whether we should also reference the inherent jurisdiction. The Part 24 test is well established but worth setting out the threshold explicitly.' },
    { id: '2', author: 'Senior Counsel', date: '2025-02-10T14:10:00Z', initials: 'SC', text: 'We need the exact date of the IMA and the precise initial value. Check the disclosure.' },
    { id: '3', author: 'Senior Counsel', date: '2025-02-10T14:40:00Z', initials: 'SC', text: 'Rubenstein is good but we should also cite Loosemore v Financial Concepts [2001] Lloyd\'s Rep PN 235 for the duty to stay within mandate. Check if there\'s anything more recent.' },
    { id: '4', author: 'Senior Counsel', date: '2025-02-10T15:10:00Z', initials: 'SC', text: 'Has Dr Chen\'s report been served? If not, we cannot rely on it at this stage. Flag to the team.' },
  ];

  const doc = wrapDocument(body);
  const comm = makeCommentsXml(comments);
  return makeDocx('Skeleton Argument — Meridian v Atlas', doc, comm);
}

// ─── FIXTURE 2: Partner's Markup ───────────────────────────────────

function fixture2_partnerMarkup() {
  const body = [
    p('SKELETON ARGUMENT ON BEHALF OF THE CLAIMANT'),
    p('IN THE HIGH COURT OF JUSTICE'),
    p('BUSINESS AND PROPERTY COURTS OF ENGLAND AND WALES'),
    p('COMMERCIAL COURT (QBD)'),
    p('Claim No. CL-2025-000142'),
    p('BETWEEN:'),
    p('MERIDIAN CAPITAL PARTNERS LLP (Claimant)'),
    p('— and —'),
    p('ATLAS INFRASTRUCTURE GROUP PLC (Defendant)'),
    p('INTRODUCTION'),
    pWithComment(
      'This skeleton argument is filed on behalf of the Claimant in support of its application for summary judgment pursuant to CPR Part 24.',
      '100'
    ),
    p('The Claimant submits that the loss was caused by the Defendant\'s breach of the Investment Management Agreement dated 15 March 2023.'),
    pWithComment(
      'The claim arises from the Defendant\'s systematic failure to maintain adequate risk controls in relation to the Emerging Markets Portfolio, resulting in losses of approximately £4.2 million.',
      '101'
    ),
    pWithDeletion(
      'The Defendant had absolutely no reasonable basis for allowing the concentrated position in Andean Mining Corp to exceed the 15% sector limit ',
      'imposed by the IMA.',
      '',
      'Partner',
      '110',
      '2025-02-11T09:30:00Z'
    ),
    pWithInsertion(
      'The Defendant had absolutely no reasonable basis for allowing the concentrated position in Andean Mining Corp to exceed the 15% sector limit',
      ' prescribed by clause 6.2(a) of the IMA.',
      '',
      'Partner',
      '111',
      '2025-02-11T09:30:00Z'
    ),
    p('FACTUAL BACKGROUND'),
    p('By the IMA, the Defendant was appointed as discretionary investment manager of the Claimant\'s Emerging Markets Portfolio with an initial value of approximately £28 million.'),
    pWithComment(
      'The IMA contained express risk limits including which the Defendant acknowledged in correspondence dated 22 March 2023.',
      '102'
    ),
    p('Between September and November 2024, the Defendant increased the Portfolio\'s exposure to Andean Mining Corp from 3.2% to 22.7%, in clear breach of the IMA limits.'),
    p('The Defendant failed to notify the Claimant of this breach despite multiple opportunities to do so, contrary to clause 8.4 of the IMA which required immediate notification of any limit breach.'),
    p('LEGAL FRAMEWORK'),
    pWithComment(
      'The applicable legal principles are well established. An investment manager owes contractual duties to manage a portfolio within the agreed risk parameters: Gestmin SGPS SA v Credit Suisse (UK) Ltd [2013] EWHC 3560 (Comm).',
      '103'
    ),
    pWithComment(
      'Where a manager exceeds agreed limits without authorisation, the manager is in breach regardless of whether the investment would have been profitable: Rubenstein v HSBC Bank plc [2012] EWCA Civ 1184.',
      '104'
    ),
    p('The standard of care required is that of a reasonably competent investment manager: Spreadex Ltd v Sekhon [2008] EWHC 1136 (Ch).'),
    p('CAUSATION AND LOSS'),
    p('The Claimant\'s loss is the difference between the value of the Portfolio as it should have been managed and its actual value as at the date of discovery of the breach.'),
    pWithComment(
      'Expert evidence from Dr Sarah Chen of Quantitative Risk Associates confirms that a compliant portfolio would have returned approximately 6.8% over the relevant period, compared to the actual loss of 14.2%.',
      '105'
    ),
    pWithSubstitution(
      'The total loss claimed is £4,186,340, being the aggregate of the excess position loss of £3,847,200 ',
      'and consequential portfolio rebalancing costs of £339,140.',
      'together with consequential portfolio rebalancing costs of £339,140 and the costs of obtaining replacement investment management services.',
      '',
      'Partner',
      '112', '113',
      '2025-02-11T10:00:00Z'
    ),
    p('RELIEF SOUGHT'),
    pWithSubstitution(
      'The Claimant seeks summary judgment for damages in the sum of ',
      '£4,186,340',
      '£4,186,340 (or such other sum as the Court may determine)',
      ' together with interest pursuant to section 35A of the Senior Courts Act 1981 and costs.',
      'Partner',
      '114', '115',
      '2025-02-11T10:05:00Z'
    ),
  ].join('\n');

  const comments = [
    { id: '100', author: 'Partner', date: '2025-02-11T09:00:00Z', initials: 'JP', text: 'Are we confident about summary judgment? The Defendant will argue there are triable issues on quantum. Consider whether we should seek an interim payment instead or in the alternative.' },
    { id: '101', author: 'Partner', date: '2025-02-11T09:15:00Z', initials: 'JP', text: 'I would say "deliberate or reckless" rather than "systematic" — the latter implies we need to prove a pattern whereas recklessness is sufficient and harder to defend.' },
    { id: '102', author: 'Partner', date: '2025-02-11T09:45:00Z', initials: 'JP', text: 'This paragraph seems incomplete. Where are the specific risk limits? We need the 15% sector limit and 5% issuer limit stated explicitly here.' },
    { id: '103', author: 'Partner', date: '2025-02-11T10:15:00Z', initials: 'JP', text: 'Gestmin is primarily about the reliability of witness recollection testimony, not investment management duties. Check the citation. Do you mean JP Morgan Chase Bank v Springwell Navigation [2008] EWHC 1186 (Comm)?' },
    { id: '104', author: 'Partner', date: '2025-02-11T10:20:00Z', initials: 'JP', text: 'Good authority. Also add: Camerata Property Inc v Credit Suisse Securities (Europe) Ltd [2012] EWHC 7 (Comm) at [222].' },
    { id: '105', author: 'Partner', date: '2025-02-11T10:30:00Z', initials: 'JP', text: 'The 6.8% figure needs to be in Dr Chen\'s report. I recall her draft said 7.1%. Please double-check before we file.' },
  ];

  const doc = wrapDocument(body);
  const comm = makeCommentsXml(comments);
  return makeDocx('Skeleton Argument — Meridian v Atlas', doc, comm);
}

// ─── FIXTURE 3: Client's Markup ────────────────────────────────────

function fixture3_clientMarkup() {
  const body = [
    p('SKELETON ARGUMENT ON BEHALF OF THE CLAIMANT'),
    p('IN THE HIGH COURT OF JUSTICE'),
    p('BUSINESS AND PROPERTY COURTS OF ENGLAND AND WALES'),
    p('COMMERCIAL COURT (QBD)'),
    p('Claim No. CL-2025-000142'),
    p('BETWEEN:'),
    p('MERIDIAN CAPITAL PARTNERS LLP (Claimant)'),
    p('— and —'),
    p('ATLAS INFRASTRUCTURE GROUP PLC (Defendant)'),
    p('INTRODUCTION'),
    p('This skeleton argument is filed on behalf of the Claimant in support of its application for summary judgment pursuant to CPR Part 24.'),
    p('The Claimant submits that the loss was caused by the Defendant\'s breach of the Investment Management Agreement dated 15 March 2023.'),
    pWithComment(
      'The claim arises from the Defendant\'s systematic failure to maintain adequate risk controls in relation to the Emerging Markets Portfolio, resulting in losses of approximately £4.2 million.',
      '200'
    ),
    p('The Defendant had absolutely no reasonable basis for allowing the concentrated position in Andean Mining Corp to exceed the 15% sector limit imposed by the IMA.'),
    p('FACTUAL BACKGROUND'),
    pWithComment(
      'By the IMA, the Defendant was appointed as discretionary investment manager of the Claimant\'s Emerging Markets Portfolio with an initial value of approximately £28 million.',
      '201'
    ),
    p('The IMA contained express risk limits including which the Defendant acknowledged in correspondence dated 22 March 2023.'),
    pWithComment(
      'Between September and November 2024, the Defendant increased the Portfolio\'s exposure to Andean Mining Corp from 3.2% to 22.7%, in clear breach of the IMA limits.',
      '202'
    ),
    p('The Defendant failed to notify the Claimant of this breach despite multiple opportunities to do so, contrary to clause 8.4 of the IMA which required immediate notification of any limit breach.'),
    p('LEGAL FRAMEWORK'),
    p('The applicable legal principles are well established. An investment manager owes contractual duties to manage a portfolio within the agreed risk parameters: Gestmin SGPS SA v Credit Suisse (UK) Ltd [2013] EWHC 3560 (Comm).'),
    p('Where a manager exceeds agreed limits without authorisation, the manager is in breach regardless of whether the investment would have been profitable: Rubenstein v HSBC Bank plc [2012] EWCA Civ 1184.'),
    p('The standard of care required is that of a reasonably competent investment manager: Spreadex Ltd v Sekhon [2008] EWHC 1136 (Ch).'),
    p('CAUSATION AND LOSS'),
    p('The Claimant\'s loss is the difference between the value of the Portfolio as it should have been managed and its actual value as at the date of discovery of the breach.'),
    pWithComment(
      'Expert evidence from Dr Sarah Chen of Quantitative Risk Associates confirms that a compliant portfolio would have returned approximately 6.8% over the relevant period, compared to the actual loss of 14.2%.',
      '203'
    ),
    p('The total loss claimed is £4,186,340, being the aggregate of the excess position loss of £3,847,200 and consequential portfolio rebalancing costs of £339,140.'),
    p('RELIEF SOUGHT'),
    p('The Claimant seeks summary judgment for damages in the sum of £4,186,340 together with interest pursuant to section 35A of the Senior Courts Act 1981 and costs.'),
  ].join('\n');

  const comments = [
    { id: '200', author: 'Client (R. Meridian)', date: '2025-02-12T11:00:00Z', initials: 'RM', text: 'DO NOT reference the internal audit report from July 2024. That is privileged and must not be disclosed. The £4.2m figure is fine but please ensure it does not derive from the audit.' },
    { id: '201', author: 'Client (R. Meridian)', date: '2025-02-12T11:05:00Z', initials: 'RM', text: 'The initial value was actually £28.4 million, not "approximately £28 million". We have the exact figure from our accounts.' },
    { id: '202', author: 'Client (R. Meridian)', date: '2025-02-12T11:10:00Z', initials: 'RM', text: 'We first became aware of the breach on 18 November 2024, not earlier. The timeline matters because Atlas will argue we acquiesced. We did not.' },
    { id: '203', author: 'Client (R. Meridian)', date: '2025-02-12T11:30:00Z', initials: 'RM', text: 'Dr Chen\'s retainer agreement was signed with my authority. Her report is almost finalised. She told me on the phone the figure is 7.1% not 6.8%. Please update.' },
  ];

  const doc = wrapDocument(body);
  const comm = makeCommentsXml(comments);
  return makeDocx('Skeleton Argument — Meridian v Atlas', doc, comm);
}

// ─── FIXTURE 4: Junior's Markup (typos/formatting) ─────────────────

function fixture4_juniorMarkup() {
  const body = [
    p('SKELETON ARGUMENT ON BEHALF OF THE CLAIMANT'),
    p('IN THE HIGH COURT OF JUSTICE'),
    p('BUSINESS AND PROPERTY COURTS OF ENGLAND AND WALES'),
    p('COMMERCIAL COURT (QBD)'),
    p('Claim No. CL-2025-000142'),
    p('BETWEEN:'),
    p('MERIDIAN CAPITAL PARTNERS LLP (Claimant)'),
    p('— and —'),
    p('ATLAS INFRASTRUCTURE GROUP PLC (Defendant)'),
    p('INTRODUCTION'),
    p('This skeleton argument is filed on behalf of the Claimant in support of its application for summary judgment pursuant to CPR Part 24.'),
    pWithSubstitution(
      'The Claimant submits that the loss was caused by the Defendant\'s breach of the Investment Management Agreement dated ',
      '15 March 2023.',
      '15 March 2023 (the "IMA").',
      '',
      'Junior Associate',
      '300', '301',
      '2025-02-12T16:00:00Z'
    ),
    p('The claim arises from the Defendant\'s systematic failure to maintain adequate risk controls in relation to the Emerging Markets Portfolio, resulting in losses of approximately £4.2 million.'),
    pWithSubstitution(
      'The Defendant had absolutely no reasonable basis for allowing the concentrated position in Andean Mining Corp to exceed the 15% sector limit ',
      'imposed',
      'prescribed',
      ' by the IMA.',
      'Junior Associate',
      '302', '303',
      '2025-02-12T16:05:00Z'
    ),
    p('FACTUAL BACKGROUND'),
    p('By the IMA, the Defendant was appointed as discretionary investment manager of the Claimant\'s Emerging Markets Portfolio with an initial value of approximately £28 million.'),
    p('The IMA contained express risk limits including which the Defendant acknowledged in correspondence dated 22 March 2023.'),
    pWithSubstitution(
      'Between September and November 2024, the Defendant increased the Portfolio\'s exposure to Andean Mining ',
      'Corp',
      'Corporation',
      ' from 3.2% to 22.7%, in clear breach of the IMA limits.',
      'Junior Associate',
      '304', '305',
      '2025-02-12T16:10:00Z'
    ),
    p('The Defendant failed to notify the Claimant of this breach despite multiple opportunities to do so, contrary to clause 8.4 of the IMA which required immediate notification of any limit breach.'),
    p('LEGAL FRAMEWORK'),
    pWithComment(
      'The applicable legal principles are well established. An investment manager owes contractual duties to manage a portfolio within the agreed risk parameters: Gestmin SGPS SA v Credit Suisse (UK) Ltd [2013] EWHC 3560 (Comm).',
      '250'
    ),
    p('Where a manager exceeds agreed limits without authorisation, the manager is in breach regardless of whether the investment would have been profitable: Rubenstein v HSBC Bank plc [2012] EWCA Civ 1184.'),
    pWithSubstitution(
      'The standard of care required is that of a reasonably competent investment manager: ',
      'Spreadex Ltd v Sekhon [2008] EWHC 1136 (Ch).',
      'Spreadex Ltd v Sekhon [2008] EWHC 1136 (Ch); see also Seymour v Ockwell [2005] EWHC 1137 (QB) at [77].',
      '',
      'Junior Associate',
      '306', '307',
      '2025-02-12T16:20:00Z'
    ),
    p('CAUSATION AND LOSS'),
    p('The Claimant\'s loss is the difference between the value of the Portfolio as it should have been managed and its actual value as at the date of discovery of the breach.'),
    p('Expert evidence from Dr Sarah Chen of Quantitative Risk Associates confirms that a compliant portfolio would have returned approximately 6.8% over the relevant period, compared to the actual loss of 14.2%.'),
    p('The total loss claimed is £4,186,340, being the aggregate of the excess position loss of £3,847,200 and consequential portfolio rebalancing costs of £339,140.'),
    p('RELIEF SOUGHT'),
    p('The Claimant seeks summary judgment for damages in the sum of £4,186,340 together with interest pursuant to section 35A of the Senior Courts Act 1981 and costs.'),
  ].join('\n');

  const comments = [
    { id: '250', author: 'Junior Associate', date: '2025-02-12T16:15:00Z', initials: 'TA', text: 'I checked Gestmin — it is about witness recollection, not investment management per se. Should we use JP Morgan v Springwell [2008] EWHC 1186 (Comm) instead? That directly concerns investment management duties.' },
  ];

  const doc = wrapDocument(body);
  const comm = makeCommentsXml(comments);
  return makeDocx('Skeleton Argument — Meridian v Atlas', doc, comm);
}

// ─── FIXTURE 5: Minimal Document (no comments, no changes) ────────

function fixture5_minimal() {
  const body = [
    p('WITNESS STATEMENT OF JOHN SMITH'),
    p('I, John Smith, of 42 Chancery Lane, London WC2A 1JE, say as follows:'),
    p('I am a director of the Claimant and I am authorised to make this statement on its behalf.'),
    p('I make this statement from facts within my own knowledge, except where I indicate otherwise.'),
  ].join('\n');

  const doc = wrapDocument(body);
  return makeDocx('Witness Statement — John Smith', doc, null);
}

// ─── FIXTURE 6: Heavy Comments (stress test) ──────────────────────

function fixture6_heavyComments() {
  const paragraphs = [];
  const comments = [];
  let commentId = 500;

  for (let i = 0; i < 30; i++) {
    const authors = ['Reviewer A', 'Reviewer B', 'Reviewer C'];
    const text = `Paragraph ${i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.`;

    if (i % 2 === 0) {
      paragraphs.push(pWithComment(text, String(commentId)));
      comments.push({
        id: String(commentId),
        author: authors[i % 3],
        date: `2025-03-01T${String(10 + (i % 12)).padStart(2, '0')}:00:00Z`,
        initials: authors[i % 3][0] + authors[i % 3].split(' ')[1][0],
        text: `Comment on paragraph ${i + 1}: This needs to be reviewed carefully. Consider the implications of the phrasing used here.`,
      });
      commentId++;
    } else if (i % 3 === 0) {
      paragraphs.push(pWithSubstitution(
        text.slice(0, 30),
        text.slice(30, 60),
        'REPLACEMENT TEXT FOR TESTING PURPOSES',
        text.slice(60),
        authors[i % 3],
        String(commentId), String(commentId + 1),
        `2025-03-01T${String(10 + (i % 12)).padStart(2, '0')}:30:00Z`
      ));
      commentId += 2;
    } else {
      paragraphs.push(p(text));
    }
  }

  const doc = wrapDocument(paragraphs.join('\n'));
  const comm = makeCommentsXml(comments);
  return makeDocx('Stress Test — Heavy Comments', doc, comm);
}

// ─── FIXTURE 7: Empty Document ─────────────────────────────────────

function fixture7_empty() {
  const body = '';
  const doc = wrapDocument(body);
  return makeDocx('Empty Document', doc, null);
}

// ─── FIXTURE 8: Wholesale paragraph insertions and deletions ───────

function fixture8_wholesaleChanges() {
  const body = [
    p('SKELETON ARGUMENT ON BEHALF OF THE CLAIMANT'),
    p('INTRODUCTION'),
    p('This is the opening paragraph of the skeleton argument, setting out the nature of the application.'),
    // Wholly deleted paragraph — counsel removed it entirely
    `<w:p>
  <w:del w:id="400" w:author="Senior Counsel" w:date="2025-02-15T10:00:00Z">
    <w:r><w:delText xml:space="preserve">This paragraph contained a submission about the standard of proof which counsel considered unnecessary and asked to be removed entirely from the draft.</w:delText></w:r>
  </w:del>
</w:p>`,
    p('The Claimant seeks summary judgment pursuant to CPR Part 24.'),
    // Wholly inserted paragraph — counsel added a new section
    `<w:p>
  <w:ins w:id="401" w:author="Senior Counsel" w:date="2025-02-15T10:15:00Z">
    <w:r><w:t xml:space="preserve">PRELIMINARY ISSUE: The Court is invited to determine as a preliminary issue whether the IMA's limitation clause (clause 14.3) is enforceable. The Claimant submits it is not, for the reasons set out below.</w:t></w:r>
  </w:ins>
</w:p>`,
    // Another wholly inserted paragraph
    `<w:p>
  <w:ins w:id="402" w:author="Senior Counsel" w:date="2025-02-15T10:20:00Z">
    <w:r><w:t xml:space="preserve">The limitation clause purports to exclude liability for losses arising from "market movements" but the losses here arose from breach of the risk limits, not from market movements per se. The distinction is critical: see Titan Steel Wheels Ltd v Royal Bank of Scotland [2010] EWHC 211 (Comm) at [89].</w:t></w:r>
  </w:ins>
</w:p>`,
    p('FACTUAL BACKGROUND'),
    p('The relevant facts are not materially in dispute.'),
    // Wholesale deletion of a whole section
    `<w:p>
  <w:del w:id="403" w:author="Partner" w:date="2025-02-15T14:00:00Z">
    <w:r><w:delText xml:space="preserve">ALTERNATIVE CLAIM IN NEGLIGENCE: In the alternative, the Claimant advances a claim in the tort of negligence. The Defendant owed a duty of care to the Claimant as its investment manager.</w:delText></w:r>
  </w:del>
</w:p>`,
    `<w:p>
  <w:del w:id="404" w:author="Partner" w:date="2025-02-15T14:05:00Z">
    <w:r><w:delText xml:space="preserve">The standard of care is that of the ordinarily competent and prudent investment manager. The Defendant fell below this standard by concentrating 22.7% of the portfolio in a single mining stock.</w:delText></w:r>
  </w:del>
</w:p>`,
    pWithComment(
      'The Defendant failed to maintain adequate risk controls in breach of the IMA.',
      '450'
    ),
    p('RELIEF SOUGHT'),
    p('The Claimant seeks damages in the sum of £4,186,340 together with interest and costs.'),
  ].join('\n');

  const comments = [
    { id: '450', author: 'Partner', date: '2025-02-15T14:10:00Z', initials: 'JP', text: 'I have deleted the negligence section. We should focus solely on the contractual claim — it is stronger and the negligence claim may complicate limitation arguments.' },
  ];

  const doc = wrapDocument(body);
  const comm = makeCommentsXml(comments);
  return makeDocx('Skeleton Argument — Wholesale Changes', doc, comm);
}

// ─── Generate all fixtures ─────────────────────────────────────────

const FIXTURES_DIR = join(import.meta.dirname || '.', 'fixtures');

try { mkdirSync(FIXTURES_DIR, { recursive: true }); } catch {}

const fixtures = [
  ['01-senior-counsel-markup.docx', fixture1_seniorCounsel()],
  ['02-partner-markup.docx', fixture2_partnerMarkup()],
  ['03-client-markup.docx', fixture3_clientMarkup()],
  ['04-junior-markup.docx', fixture4_juniorMarkup()],
  ['05-minimal-no-comments.docx', fixture5_minimal()],
  ['06-stress-test-heavy.docx', fixture6_heavyComments()],
  ['07-empty-document.docx', fixture7_empty()],
  ['08-wholesale-insertions-deletions.docx', fixture8_wholesaleChanges()],
];

for (const [name, data] of fixtures) {
  const path = join(FIXTURES_DIR, name);
  writeFileSync(path, data);
  console.log(`✓ ${name} (${data.length} bytes)`);
}

console.log(`\nGenerated ${fixtures.length} test fixtures in ${FIXTURES_DIR}`);
