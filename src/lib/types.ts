export type FieldAlign = "left" | "center" | "right";
export type TextTransform = "none" | "upper" | "title";

/** Where one piece of per-person text is drawn on a template image. Units are image pixels. */
export interface FieldLayout {
  /** Column key this field reads its value from (e.g. "name"). */
  key: string;
  /** Left edge of the text box. */
  x: number;
  /** Text baseline — put this just above the blank line on the template. */
  y: number;
  /** Box width. Text is aligned inside it and shrunk to fit if too long. */
  width: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic?: boolean;
  color: string;
  align: FieldAlign;
  transform?: TextTransform;
  letterSpacing?: number;
}

/** One design of a certificate (e.g. Winner / Participation / Volunteer). */
export interface Variant {
  id: string;
  label: string;
  /** File name inside public/templates/<slug>/ */
  image: string;
  width: number;
  height: number;
  fields: FieldLayout[];
}

/** A piece of data each certificate needs. "email" is always available and never drawn. */
export interface Column {
  key: string;
  label: string;
  /** Extra Excel header names that should map to this column. */
  aliases?: string[];
  /** Value used when a row leaves this column blank. */
  default?: string;
}

export interface EventTemplate {
  slug: string;
  name: string;
  description?: string;
  /** Higher shows first on the home page. */
  order?: number;
  columns: Column[];
  variants: Variant[];
  email: { subject: string; body: string };
}

export type Row = Record<string, string> & { _id: string; _variant: string };
