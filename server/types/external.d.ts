// Lazily-loaded libraries without bundled type declarations. We wrap their
// outputs in `any` at the call site (email transport, pdfkit document), so an
// ambient `any` module is sufficient — no @types packages needed.
declare module 'nodemailer'
declare module 'pdfkit'
