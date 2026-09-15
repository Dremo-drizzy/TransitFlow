import { useQuery } from "@tanstack/react-query";
import { searchLocations } from "../apis/api";
import { useDebounce } from "./useDebounce";

export const useLocations = (query) => {
  const debouncedQuery = useDebounce(query?.trim() || "", 300);

  return useQuery({
    queryKey: ["locations", debouncedQuery],
    queryFn: () => searchLocations(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
};
