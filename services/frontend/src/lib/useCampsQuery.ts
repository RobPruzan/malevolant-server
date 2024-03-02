import { client } from "@/edenClient";
import { QueryOptions, useQuery } from "@tanstack/react-query";
import { Nullish } from "@fireside/utils/src/types";
import { useUserQuery } from "./useUserQuery";

export const getCampQueryOptions = ({ userId }: { userId: Nullish<string> }) =>
  ({
    queryFn: async () => {
      const res = await client.protected.camp.retrieve.get();

      if (res.error) {
        console.log("err");
        throw new Error(res.error.value);
      }
      return res.data;
    },
    queryKey: ["camps", userId],
    enabled: !!userId,
  } satisfies QueryOptions & { enabled?: boolean });

export const useCampsQuery = () => {
  const user = useUserQuery();

  return useQuery(getCampQueryOptions({ userId: user.data?.id }));
};
