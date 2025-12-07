
import { cn } from "@/lib/utils";

type TagColor = "green" | "blue" | "orange" | "purple" | "gray";

export const availableTags: { id: string; name: string; color: TagColor }[] = [
  { id: "new_customer", name: "Yeni Müşteri", color: "blue" },
  { id: "loyal_customer", name: "Sadık Müşteri", color: "green" },
  { id: "potential_project", name: "Potansiyel Proje", color: "orange" },
  { id: "high_volume", name: "Büyük Hacimli", color: "purple" },
  { id: "passive", name: "Pasif", color: "gray" },
];

export const getTagClassName = (color: TagColor) => {
  switch (color) {
    case "green":
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700";
    case "blue":
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700";
    case "orange":
        return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700";
    case "purple":
        return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700";
    case "gray":
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700/50 dark:text-gray-300 dark:border-gray-600";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700/50 dark:text-gray-300 dark:border-gray-600";
  }
};
