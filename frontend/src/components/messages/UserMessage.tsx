import { memo, type ReactNode } from "react";

import type { Attachment } from "@/types/api";
import { formatDateTime } from "@/utils/dates";
import { AttachmentView } from "./FileCard";

interface UserMessageProps {
  content: string;
  attachments?: Attachment[];
  createdAt?: string;
  /** Extra content under the text (used for upload progress while sending). */
  footer?: ReactNode;
  /** Local attachment shown while the upload is in flight. */
  localAttachment?: ReactNode;
}

export const UserMessage = memo(function UserMessage({
  content,
  attachments,
  createdAt,
  footer,
  localAttachment,
}: UserMessageProps) {
  return (
    <div className="group/user flex flex-col items-end gap-1.5">
      {(attachments?.length || localAttachment) && (
        <div className="flex max-w-[85%] flex-wrap justify-end gap-2">
          {attachments?.map((file) => <AttachmentView key={file.key} file={file} />)}
          {localAttachment}
        </div>
      )}
      {content && (
        <div className="max-w-[85%] whitespace-pre-wrap break-words user-bubble rounded-3xl rounded-br-lg px-4.5 py-3 text-[15px] leading-relaxed text-fg">
          {content}
        </div>
      )}
      {footer}
      {createdAt && (
        <time
          dateTime={createdAt}
          className="px-1 text-xs text-fg-subtle opacity-0 transition-opacity group-hover/user:opacity-100 group-focus-within/user:opacity-100 max-lg:opacity-100"
        >
          {formatDateTime(createdAt)}
        </time>
      )}
    </div>
  );
});
