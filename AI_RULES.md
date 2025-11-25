# AI Rules for PTrab Inteligente Project

This document outlines the core technologies and specific library usage guidelines for the PTrab Inteligente application. Adhering to these rules ensures consistency, maintainability, and leverages the strengths of our chosen tech stack.

## Tech Stack Overview

*   **Frontend Framework:** React
*   **Language:** TypeScript
*   **Build Tool:** Vite
*   **Styling:** Tailwind CSS
*   **UI Components:** shadcn/ui (built on Radix UI)
*   **Routing:** React Router DOM
*   **Backend & Authentication:** Supabase
*   **Data Fetching & Caching:** TanStack Query (React Query)
*   **Form Management & Validation:** React Hook Form with Zod
*   **Icons:** Lucide React
*   **Toast Notifications:** Sonner

## Library Usage Guidelines

To maintain a consistent and efficient development workflow, please follow these guidelines for library usage:

*   **UI Components:**
    *   Always prioritize `shadcn/ui` components for building the user interface.
    *   If a specific component is not available in `shadcn/ui`, create a new, small, and focused component using **Tailwind CSS** for styling. Do not modify existing `shadcn/ui` component files.
*   **Styling:**
    *   Use **Tailwind CSS** exclusively for all styling. Avoid inline styles or custom CSS files unless absolutely necessary for very specific, isolated cases (e.g., global resets in `index.css`).
*   **Icons:**
    *   Use icons from the `lucide-react` library.
*   **Routing:**
    *   Manage all client-side routing using `react-router-dom`. Keep route definitions in `src/App.tsx`.
*   **State Management & Data Fetching:**
    *   For server state management (fetching, caching, synchronizing data with the backend), use **TanStack Query (`@tanstack/react-query`)**.
    *   For local component state or simple global client state, use React's built-in `useState` and `useContext` hooks.
*   **Forms & Validation:**
    *   Implement all forms using `react-hook-form`.
    *   For schema-based form validation, use `zod` in conjunction with `@hookform/resolvers`.
*   **Backend & Authentication:**
    *   Interact with the backend and handle all authentication flows using the `supabase` client (`@supabase/supabase-js`).
*   **Toast Notifications:**
    *   For displaying transient messages (success, error, info), use the `sonner` library.
*   **Date Handling:**
    *   For date manipulation and formatting, use `date-fns`.
    *   For date picker UI components, use `react-day-picker`.
*   **Dark Mode:**
    *   Utilize `next-themes` for theme switching functionality.
*   **PDF Export:**
    *   For generating PDF documents from HTML content, use `jspdf` and `html2canvas`.
*   **Excel Export:**
    *   For generating Excel spreadsheets, use `exceljs`.
*   **Carousel Components:**
    *   For carousel or slider functionalities, use `embla-carousel-react`.
*   **Resizable Panels:**
    *   For creating resizable panel layouts, use `react-resizable-panels`.
*   **Drawers:**
    *   For bottom sheet or drawer components, use `vaul`.