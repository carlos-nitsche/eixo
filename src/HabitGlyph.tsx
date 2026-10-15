/** EIXO pictograms: original, two-tone vector artwork. Legacy keys stay compatible with saved habits. */
const glyphs: Record<string, [string, string]> = {
 '🌱':['Crescimento','M16 26V15M16 20C7 21 5 16 5 9c7 0 11 3 11 9M16 15c0-7 4-10 11-10 0 7-4 11-11 10'],
 '💧':['Água','M16 4C13 9 7 15 7 20a9 9 0 0 0 18 0c0-5-6-11-9-16ZM11 20c0 3 2 5 5 5'],
 '📚':['Leitura','M16 9v18M16 9C12 6 8 6 4 7v18c4-1 8-1 12 2 4-3 8-3 12-2V7c-4-1-8-1-12 2ZM8 12l4 1M20 13l4-1M8 17l4 1M20 18l4-1'],
 '💪':['Força','M5 11v10M9 8v16M9 16h14M23 8v16M27 11v10'],
 '🧘':['Meditação','M13 6a3 3 0 1 0 6 0 3 3 0 1 0-6 0M16 12v9M10 13l-3 7H3M22 13l3 7h4M16 21l-9 3c-3 1-2 4 1 4h16c3 0 4-3 1-4Z'],
 '🏃':['Corrida','M19 5a3 3 0 1 0 6 0 3 3 0 1 0-6 0M10 11l6-2 5 6 6 1M16 9l-4 10 8 3-2 7M12 19l-5 6H3'],
 '🥗':['Alimentação','M4 17h24c-1 8-5 11-12 11S5 25 4 17ZM9 17C3 9 9 5 14 12M16 17C15 7 21 4 24 7c4 4 0 8-3 10M19 13l4-4'],
 '😴':['Sono','M23 21A12 12 0 0 1 11 5a12 12 0 1 0 16 18M20 5h7l-7 7h7'],
 '✍️':['Escrita','M7 25l2-7L23 4l5 5-14 14-7 2ZM19 8l5 5M5 29h22'],
 '💊':['Saúde','M7 25a7 7 0 0 1 0-10L17 5a7 7 0 0 1 10 10L17 25a7 7 0 0 1-10 0ZM12 10l10 10M20 8l3 3'],
 '🪥':['Higiene','M12 27V7a3 3 0 0 1 6 0v20a3 3 0 0 1-6 0ZM18 6h7M18 10h7M18 14h7'],
 '🧹':['Organização','M20 4l-6 13M9 15l10 4 2 10H3l6-14ZM10 22l-2 7M15 23v6'],
 '💰':['Finanças','M4 10h24v17H4ZM4 10l18-6v6M22 16h6v6h-6a3 3 0 0 1 0-6ZM10 15v7M7 18h6'],
 '🎯':['Objetivo','M27 16a11 11 0 1 1-11-11M22 16a6 6 0 1 1-6-6M16 16L28 4M22 4h6v6'],
 '☀️':['Energia','M10 16a6 6 0 1 0 12 0 6 6 0 1 0-12 0M16 2v4M16 26v4M2 16h4M26 16h4M6 6l3 3M23 23l3 3M26 6l-3 3M9 23l-3 3'],
 '🚶':['Caminhada','M15 6a3 3 0 1 0 6 0 3 3 0 1 0-6 0M17 12l-3 9-5 8M14 21l7 8M17 12l5 6h5M16 13l-6 2-3 5'],
 '🧠':['Aprendizado','M16 8c-5-8-13-2-10 4-6 3-3 10 1 10-1 7 6 8 9 3 3 5 10 4 9-3 4 0 7-7 1-10 3-6-5-12-10-4ZM16 8v17M10 10l2 4-3 4M22 10l-2 4 3 4'],
 '❤️':['Bem-estar','M16 27L5 16C-2 7 9 1 16 10 23 1 34 7 27 16ZM7 17h5l3-5 3 9 3-4h4'],
 '📵':['Desconectar','M10 3h12a2 2 0 0 1 2 2v22a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM14 25h4M3 3l26 26'],
 '🎨':['Criatividade','M16 4C1 4 0 27 13 28c6 1 1-6 5-7 5-2 10 2 11-5C30 9 24 4 16 4ZM9 12h1M15 9h1M22 12h1M8 19h1'],
 '🎵':['Música','M13 24V7l14-3v17M13 12l14-3M13 24c0 5-9 6-9 1s9-6 9-1ZM27 21c0 5-9 6-9 1s9-6 9-1Z'],
 '🐾':['Animais','M10 19c-8 10 2 11 6 7 4 4 14 3 6-7-4-5-8-5-12 0ZM5 10c-4 0-4 6 0 6s4-6 0-6ZM12 4c-4 0-4 7 0 7s4-7 0-7ZM21 4c-4 0-4 7 0 7s4-7 0-7ZM28 10c-4 0-4 6 0 6s4-6 0-6Z'],
 '🏡':['Casa','M3 15L16 4l13 11M7 12v16h18V12M13 28V18h6v10M22 5v4'],
 '🕯️':['Pausa','M11 15h10v14H11ZM16 12c-6-1-2-7 0-10 2 3 6 9 0 10ZM7 29h18'],
 '🌤️':['Dia tranquilo','M16 16a6 6 0 1 0-9-6M13 2v3M23 6l-2 2M26 14h-3M4 5l3 3M8 27h17a5 5 0 0 0 0-10 8 8 0 0 0-15 2 4 4 0 1 0-2 8Z'],
};
export const habitGlyphLabel = (value: string) => glyphs[value]?.[0] || 'Hábito pessoal';
export default function HabitGlyph({value, size = 32}: {value:string;size?:number}) {
 const [label, path] = glyphs[value] || glyphs['🌱'];
 return <svg className="eixo-glyph" width={size} height={size} viewBox="0 0 40 40" fill="none" aria-label={label} role="img"><rect x="1" y="1" width="38" height="38" rx="12" fill="currentColor" opacity=".09"/><circle cx="30" cy="9" r="5" fill="currentColor" opacity=".12"/><path d={path} transform="translate(4 4)" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
