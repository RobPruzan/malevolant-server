import {
  Link,
  Outlet,
  useMatch,
  useMatchRoute,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { Input } from "../ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MutableRefObject,
  createContext,
  memo,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import {
  Edit,
  Image,
  MessageCircle,
  MessageCircleIcon,
  Pencil,
  SmilePlus,
  Trash,
} from "lucide-react";
import { Button, buttonVariants } from "../ui/button";
import { Avatar } from "../ui/avatar";
import { hasKey, run } from "@fireside/utils";
import { CampMessage } from "@fireside/db";
import {
  useGetMessages,
  // useCreateMessageMutation,
  useGetMessageReactions,
  useGetReactionAssets,
  useReactToMessageMutation,
  useRemoveReactionMutation,
} from "./message-state";
import { useDefinedUser } from "./camps-state";
import { Setter } from "@/types/utils";
import { FiresideUser } from "@/lib/useUserQuery";
import { ThreadIcon } from "../ui/icons/thread";
import { Thread } from "./Thread";
import { useGetThreads } from "./thread-state";
import { toast } from "../ui/use-toast";
import { Textarea } from "../ui/textarea";
import { client } from "@/edenClient";
import { useQueryClient } from "@tanstack/react-query";
import { PublishedMessage } from "@fireside/backend/src/message-endpoints";
import { threadId } from "worker_threads";
import { WhiteBoardLoader } from "./whiteboard/WhiteBoard";
const subscribeFn = client.api.protected.message.ws({
  campId: "anything",
}).subscribe;

type Subscription = null | ReturnType<typeof subscribeFn>;
const SocketMessageContext = createContext<{
  subscriptionRef: MutableRefObject<Subscription> | null;
}>({
  subscriptionRef: null,
});
export const Camp = () => {
  const { campId } = useParams({ from: "/root-auth/camp-layout/camp/$campId" });
  const { messages } = useGetMessages({ campId });
  const scrollRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const lastChild = scrollRef.current?.lastChild!;
    if (lastChild instanceof HTMLElement) {
      // #TODO don't auto scroll if the user has scrolled up in view port
      lastChild.scrollIntoView({
        behavior: "instant",
        block: "end",
        inline: "nearest",
      });
    }
  }, [messages.length]);

  const match = useMatchRoute();
  const search = useSearch({ from: "/root-auth/camp-layout/camp/$campId" });

  // const key
  const searchEntries = Object.entries(search);
  return (
    <div className="flex  w-full h-full px-5 pb-5">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel className="h-full w-full">
          <MessageSection campId={campId} />
        </ResizablePanel>
        <ResizableHandle
          className="bg-accent/50 w-[2px]"
          withHandle={searchEntries.length > 0}
        />

        {searchEntries.length > 0 && (
          <ResizablePanel className="p-1  h-full flex flex-col">
            <ResizablePanelGroup direction="vertical">
              {searchEntries.map(([k, v], index) => {
                const typedKey = k as keyof typeof search;

                switch (typedKey) {
                  case "threadId": {
                    return v ? (
                      <>
                        <ResizablePanel
                          key={k}
                          id={k}
                          style={{
                            height: `${100 / searchEntries.length}%`,
                          }}
                          minSize={30}
                          className={cn([" w-full"])}
                        >
                          <Thread threadId={v} />
                        </ResizablePanel>

                        {index !== searchEntries.length - 1 && (
                          <ResizableHandle
                            className="bg-accent/50"
                            withHandle={searchEntries.length > 0}
                          />
                        )}
                      </>
                    ) : null;
                  }

                  case "whiteBoardId": {
                    return v ? (
                      <>
                        <ResizablePanel
                          key={k}
                          style={{
                            height: `${100 / Object.entries(search).length}%`,
                          }}
                          minSize={30}
                          className={cn([" w-full"])}
                        >
                          <WhiteBoardLoader whiteBoardId={v} />
                        </ResizablePanel>

                        {index !== searchEntries.length - 1 && (
                          <ResizableHandle
                            className="bg-accent/50 "
                            withHandle={searchEntries.length > 0}
                          />
                        )}
                      </>
                    ) : null;
                  }
                }
              })}
            </ResizablePanelGroup>
          </ResizablePanel>
        )}
      </ResizablePanelGroup>
    </div>
  );
};

const MessageSection = memo(({ campId }: { campId: string }) => {
  const [userMessage, setUserMessage] = useState("");

  const { messages } = useGetMessages({ campId });
  const scrollRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const { messagesQueryKey } = useGetMessages({ campId });
  const { threadsQueryKey } = useGetThreads({ campId });
  const user = useDefinedUser();
  useEffect(() => {
    const lastChild = scrollRef.current?.lastChild!;
    if (lastChild instanceof HTMLElement) {
      // #TODO don't auto scroll if the user has scrolled up in view port
      lastChild.scrollIntoView({
        behavior: "instant",
        block: "end",
        inline: "nearest",
      });
    }
  }, [messages.length]);

  const updateMessageCache = ({ message, thread }: PublishedMessage) => {
    queryClient.setQueryData(messagesQueryKey, (prev) => [
      ...(prev ?? []),
      {
        user,
        userId: user.id,
        ...message,
      },
    ]);

    queryClient.setQueryData(threadsQueryKey, (prev) => [
      ...(prev ?? []),
      {
        userId: user.id,
        campId,
        createdBy: user.id,
        ...thread,
      },
    ]);
  };
  const subscriptionRef = useRef<null | ReturnType<typeof subscribeFn>>(null);

  useEffect(() => {
    const newSubscription = client.api.protected.message
      .ws({ campId })
      .subscribe();

    newSubscription.on("message", (event) => {
      updateMessageCache(event.data as PublishedMessage);
    });
    subscriptionRef.current = newSubscription;
    return () => {
      newSubscription.close();
    };
  }, []);

  const [messageWithContextMenuId, setMessageWithContextMenuId] = useState<
    null | string
  >(null);

  return (
    <SocketMessageContext.Provider
      value={{
        subscriptionRef,
      }}
    >
      <div className="p-1  flex flex-col h-full  w-full px-2">
        <div className="flex w-full h-[calc(100%-85px)] ">
          <div
            ref={scrollRef}
            className="flex flex-col w-full h-full overflow-y-auto gap-y-3"
          >
            {messages
              .sort(
                (a, b) =>
                  new Date(a.createdAt).getTime() -
                  new Date(b.createdAt).getTime()
              )
              .map((messageObj, index) => (
                <Message
                  campId={campId}
                  key={messageObj.id}
                  messageObj={messageObj}
                  messageWithContextMenuId={messageWithContextMenuId}
                  setMessageWithContextMenuId={setMessageWithContextMenuId}
                  order={
                    index === 0
                      ? "first"
                      : index === messages.length - 1
                      ? "last"
                      : "middle"
                  }
                />
              ))}
          </div>
        </div>

        <Textarea
          placeholder="Send a question..."
          onKeyDown={(e) => {
            console.log("keydown");
            if (!userMessage && e.key === "Enter" && !e.shiftKey) {
              setUserMessage("");
              e.preventDefault();
              return;
            }

            if (e.key === "Enter" && !e.shiftKey) {
              const parentMessageId = crypto.randomUUID();

              const newMessage = {
                campId,
                createdAt: new Date().toISOString(),
                id: parentMessageId,
                message: userMessage,
                // userId: user.id
              };
              const newThread = {
                createdAt: new Date().toISOString(),
                id: crypto.randomUUID(),
                parentMessageId: parentMessageId,
              };

              subscriptionRef.current?.send({
                message: newMessage,
                thread: newThread,
              });

              updateMessageCache({
                message: newMessage,
                thread: newThread,
              });

              setUserMessage("");
              e.preventDefault();
            }
          }}
          value={userMessage}
          onChange={(event) => setUserMessage(event.target.value)}
          className="flex h-[50px] border-2 border-accent/50"
        />
      </div>
    </SocketMessageContext.Provider>
  );
});

const ReactionMenuContent = memo(
  ({ messageId, campId }: { messageId: string; campId: string }) => {
    // const { campId } = useParams({ from: "/root-auth/camp-layout/camp/$campId" });
    const reactMutation = useReactToMessageMutation({
      campId,
    });
    const { messageReactions } = useGetMessageReactions({ campId });
    const { reactionAssets } = useGetReactionAssets();
    const user = useDefinedUser();
    const reactions = messageReactions.filter(
      (reaction) => reaction.messageId === messageId
    );
    console.log("are u running?");
    return reactionAssets.map((asset) => {
      const existingReaction = reactions
        .filter(
          ({ reactionAssetId, messageId: iterMessageId }) =>
            reactionAssetId === asset.id && iterMessageId === messageId
        )
        .find(({ userId }) => userId === user.id);

      return (
        <Button
          disabled={!!existingReaction}
          key={asset.id}
          onClick={() => {
            reactMutation.mutate({
              messageId,
              reactionAssetId: asset.id,
              id: crypto.randomUUID(),
            });
          }}
          variant={"ghost"}
          className="h-7 w-7 p-0"
        >
          <img src={asset.imgSrc} alt={asset.alt} />
        </Button>
      );
    });
  }
);

const Message = memo(
  ({
    messageObj,
    order = "middle",
    setMessageWithContextMenuId,
    messageWithContextMenuId,
    campId,
  }: {
    messageObj: CampMessage & { user: NonNullable<FiresideUser> };
    order?: "first" | "last" | "middle";
    setMessageWithContextMenuId: Setter<string | null>;
    messageWithContextMenuId: string | null;
    campId: string;
  }) => {
    const { threads } = useGetThreads({ campId });

    const thread = threads.find(
      (thread) => thread.parentMessageId === messageObj.id
    );

    return (
      <div
        className={cn([
          "w-full flex ",
          order === "last" && "pb-4",
          order === "first" && "pt-4",
        ])}
      >
        <ContextMenu
          onOpenChange={(v) => {
            if (v) {
              setMessageWithContextMenuId(messageObj.id);
              return;
            }

            setMessageWithContextMenuId(null);
          }}
        >
          <ContextMenuTrigger asChild>
            <div
              className={cn([
                "space-y-4 border-2 border-accent/50 w-full p-3 rounded-md",
                messageWithContextMenuId === messageObj.id && "bg-muted",
              ])}
            >
              <div className="flex items-center space-x-4">
                <div className="flex items-start space-x-2 w-full">
                  <Avatar className="w-10 h-10 grid place-content-center border">
                    <Image size={20} />
                  </Avatar>
                  <div className="text-sm font-medium leading-none">
                    <h3 className="text-base">{messageObj.user.email}</h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex gap-x-1">
                        <span>
                          {new Date(messageObj.createdAt).toLocaleDateString()}
                        </span>
                        <span>
                          {new Date(messageObj.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </span>
                    <div className="flex gap-x-1 items-center">
                      {thread?.id ? (
                        <Link
                          from="/camp/$campId"
                          search={(prev) => ({
                            ...prev,
                            threadId: thread.id,
                          })}
                          preload={false}
                          // params={{
                          //   threadId: thread?.id,
                          //   campId: campId,
                          // }}
                          className={buttonVariants({
                            variant: "ghost",

                            className:
                              " text-foreground h-fit  py-1 pl-1 px-1 pb-1 pt-1 pr-1 ",
                          })}
                        >
                          <MessageCircleIcon size={20} />
                        </Link>
                      ) : (
                        <Button
                          onClick={() => {
                            toast({
                              title: "Thread not available yet",
                              description: "Try again in a few seconds",
                            });
                          }}
                          variant={"ghost"}
                          className=" text-foreground h-fit py-1 pl-1 px-1 pb-1 pt-1 pr-1  "
                        >
                          <MessageCircleIcon size={20} />
                        </Button>
                      )}
                      <Link
                        // from=""
                        from="/camp/$campId"
                        search={(prev) => ({
                          ...prev,
                          whiteBoardId: crypto.randomUUID(),
                        })}
                        preload={false}
                        className={buttonVariants({
                          variant: "ghost",
                          className: cn([
                            "h-full py-1 px-1",
                            " text-foreground h-fit  py-1  px-1 pb-1 pt-1 pr-1 pl-1",
                          ]),
                        })}
                      >
                        <Pencil size={20} />
                      </Link>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button className="h-7 w-7 p-1" variant={"ghost"}>
                            <SmilePlus />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48 flex flex-wrap gap-2 items-center">
                          <ReactionMenuContent
                            campId={campId}
                            messageId={messageObj.id}
                          />
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <div className="flex flex-wrap gap-x-2">
                        <ReactionBox
                          campId={campId}
                          messageId={messageObj.id}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="max-w-none break-words ">
                {messageObj.message}
              </div>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem className="flex gap-x-2">
              <Edit size={17} /> Edit
            </ContextMenuItem>

            <ContextMenuSub>
              <ContextMenuSubTrigger className="flex gap-x-2 ">
                <SmilePlus size={17} /> Reactions
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-48 flex flex-wrap gap-2 items-center">
                <ReactionMenuContent
                  campId={campId}
                  messageId={messageObj.id}
                />
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuItem className="flex gap-x-2 text-destructive">
              <Trash size={17} /> Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    );
  }
);

const ReactionBox = memo(
  ({ campId, messageId }: { messageId: string; campId: string }) => {
    const reactMutation = useReactToMessageMutation({ campId });
    const { messageReactions } = useGetMessageReactions({ campId });
    const { reactionAssets } = useGetReactionAssets();
    const removeReactionMutation = useRemoveReactionMutation({ campId });
    const user = useDefinedUser();
    const reactions = messageReactions.filter(
      (reaction) => reaction.messageId === messageId
    );

    const count: Record<string, number> = {};

    reactions.forEach((reaction) =>
      count[reaction.reactionAssetId]
        ? (count[reaction.reactionAssetId] =
            count[reaction.reactionAssetId] + 1)
        : (count[reaction.reactionAssetId] = 1)
    );

    return Object.entries(count).map(([reactionAssetId, count]) => {
      const asset = reactionAssets.find(({ id }) => id === reactionAssetId)!;

      const existingReaction = reactions
        .filter(
          ({ reactionAssetId, messageId }) =>
            reactionAssetId === asset.id && messageId === messageId
        )
        .find(({ userId }) => userId === user.id);
      return (
        <div key={asset.id} className="flex items-center">
          <Button
            onClick={() => {
              if (existingReaction) {
                removeReactionMutation.mutate({
                  reactionId: existingReaction.id,
                });
                return;
              }

              reactMutation.mutate({
                messageId: messageId,
                reactionAssetId: asset.id,
                id: crypto.randomUUID(),
              });
            }}
            className={cn(["h-9 w-9 p-1 ", existingReaction && "bg-muted/50"])}
            variant={"ghost"}
          >
            <img src={asset.imgSrc} alt={asset.alt} />
          </Button>
          {count}
        </div>
      );
    });
  }
);
