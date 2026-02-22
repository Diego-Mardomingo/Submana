import React from "react";

type IconProps = {
  size?: number;
  className?: string;
};

const createIcon = (paths: React.ReactNode) => {
  return ({ size = 24, className }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths}
    </svg>
  );
};

export const categoryIcons: Record<string, React.FC<IconProps>> = {
  home: createIcon(
    <>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </>
  ),
  car: createIcon(
    <>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-2.8-4.2a2 2 0 0 0-1.7-.8H8.5c-.7 0-1.3.3-1.7.8L4 10l-2.5 1.1C.7 11.3 0 12.1 0 13v3c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  food: createIcon(
    <>
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
    </>
  ),
  entertainment: createIcon(
    <>
      <line x1="6" y1="12" x2="6" y2="12" />
      <line x1="12" y1="12" x2="12" y2="12" />
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 12h.01" />
      <path d="M12 12h.01" />
      <path d="M18 12h.01" />
    </>
  ),
  health: createIcon(
    <>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </>
  ),
  education: createIcon(
    <>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5" />
    </>
  ),
  shopping: createIcon(
    <>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </>
  ),
  finance: createIcon(
    <>
      <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z" />
      <path d="M2 9v1c0 1.1.9 2 2 2h1" />
      <path d="M16 11h.01" />
    </>
  ),
  income: createIcon(
    <>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </>
  ),
  rent: createIcon(
    <>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </>
  ),
  utilities: createIcon(
    <>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </>
  ),
  repairs: createIcon(
    <>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </>
  ),
  fuel: createIcon(
    <>
      <path d="M3 22V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14" />
      <path d="M5 22h10" />
      <path d="M15 12h2a2 2 0 0 1 2 2v6h-2" />
      <path d="M19 12V6" />
      <path d="M7 14h4" />
      <circle cx="20" cy="4" r="2" />
    </>
  ),
  maintenance: createIcon(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  transport: createIcon(
    <>
      <rect x="3" y="11" width="18" height="8" rx="2" />
      <path d="M6 19v2" />
      <path d="M18 19v2" />
      <path d="M3 11V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3" />
      <circle cx="7" cy="15" r="1" />
      <circle cx="17" cy="15" r="1" />
    </>
  ),
  groceries: createIcon(
    <>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </>
  ),
  restaurants: createIcon(
    <>
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
    </>
  ),
  streaming: createIcon(
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <polygon points="10 8 16 11 10 14 10 8" />
    </>
  ),
  leisure: createIcon(
    <>
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </>
  ),
  travel: createIcon(
    <>
      <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </>
  ),
  medical: createIcon(
    <>
      <path d="M8 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4l4-2z" />
      <path d="M12 11v6" />
      <path d="M9 14h6" />
    </>
  ),
  pharmacy: createIcon(
    <>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M12 11v4" />
      <path d="M10 13h4" />
    </>
  ),
  gym: createIcon(
    <>
      <path d="M6.5 6.5a2.5 2.5 0 0 1 5 0v11a2.5 2.5 0 0 1-5 0v-11z" />
      <path d="M12.5 6.5a2.5 2.5 0 0 1 5 0v11a2.5 2.5 0 0 1-5 0v-11z" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="M4 9v6" />
      <path d="M20 9v6" />
    </>
  ),
  courses: createIcon(
    <>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      <path d="M8 7h6" />
      <path d="M8 11h8" />
    </>
  ),
  books: createIcon(
    <>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </>
  ),
  clothing: createIcon(
    <>
      <path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
    </>
  ),
  tech: createIcon(
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </>
  ),
  savings: createIcon(
    <>
      <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z" />
      <path d="M2 9v1c0 1.1.9 2 2 2h1" />
      <path d="M16 11h.01" />
    </>
  ),
  investments: createIcon(
    <>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </>
  ),
  salary: createIcon(
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M12 9v6" />
      <path d="M9 12h6" />
    </>
  ),
  freelance: createIcon(
    <>
      <path d="M15 3h6v6" />
      <path d="M10 14L21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </>
  ),
  other: createIcon(
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </>
  ),
  category: createIcon(
    <>
      <path d="M4 9h16" />
      <path d="M4 15h16" />
      <path d="M10 3L8 21" />
      <path d="M16 3l-2 18" />
    </>
  ),
};

export const defaultCategories = [
  {
    name: "Vivienda",
    nameEn: "Housing",
    icon: "home",
    subcategories: [
      { name: "Alquiler/Hipoteca", nameEn: "Rent/Mortgage", icon: "rent" },
      { name: "Servicios", nameEn: "Utilities", icon: "utilities" },
      { name: "Reparaciones", nameEn: "Repairs", icon: "repairs" },
    ],
  },
  {
    name: "Transporte",
    nameEn: "Transport",
    icon: "car",
    subcategories: [
      { name: "Combustible", nameEn: "Fuel", icon: "fuel" },
      { name: "Mantenimiento", nameEn: "Maintenance", icon: "maintenance" },
      { name: "Transporte Público", nameEn: "Public Transport", icon: "transport" },
    ],
  },
  {
    name: "Alimentación",
    nameEn: "Food",
    icon: "food",
    subcategories: [
      { name: "Supermercado", nameEn: "Groceries", icon: "groceries" },
      { name: "Restaurantes", nameEn: "Restaurants", icon: "restaurants" },
    ],
  },
  {
    name: "Entretenimiento",
    nameEn: "Entertainment",
    icon: "entertainment",
    subcategories: [
      { name: "Streaming", nameEn: "Streaming", icon: "streaming" },
      { name: "Ocio", nameEn: "Leisure", icon: "leisure" },
      { name: "Viajes", nameEn: "Travel", icon: "travel" },
    ],
  },
  {
    name: "Salud",
    nameEn: "Health",
    icon: "health",
    subcategories: [
      { name: "Médico", nameEn: "Medical", icon: "medical" },
      { name: "Farmacia", nameEn: "Pharmacy", icon: "pharmacy" },
      { name: "Gimnasio", nameEn: "Gym", icon: "gym" },
    ],
  },
  {
    name: "Educación",
    nameEn: "Education",
    icon: "education",
    subcategories: [
      { name: "Cursos", nameEn: "Courses", icon: "courses" },
      { name: "Libros", nameEn: "Books", icon: "books" },
    ],
  },
  {
    name: "Compras",
    nameEn: "Shopping",
    icon: "shopping",
    subcategories: [
      { name: "Ropa", nameEn: "Clothing", icon: "clothing" },
      { name: "Tecnología", nameEn: "Technology", icon: "tech" },
    ],
  },
  {
    name: "Finanzas",
    nameEn: "Finance",
    icon: "finance",
    subcategories: [
      { name: "Ahorro", nameEn: "Savings", icon: "savings" },
      { name: "Inversiones", nameEn: "Investments", icon: "investments" },
    ],
  },
  {
    name: "Ingresos",
    nameEn: "Income",
    icon: "income",
    subcategories: [
      { name: "Salario", nameEn: "Salary", icon: "salary" },
      { name: "Freelance", nameEn: "Freelance", icon: "freelance" },
      { name: "Otros", nameEn: "Other", icon: "other" },
    ],
  },
];

export function getCategoryIcon(iconKey: string | undefined, size = 24, className?: string) {
  const Icon = categoryIcons[iconKey || "category"] || categoryIcons.category;
  return <Icon size={size} className={className} />;
}
