import { PropsWithChildren } from "react";

import { Box } from "@mui/material";

import { cn } from "@/lib/utils";
import { useThemeContext } from "@/theme/theme-provider";
import { ContentType } from "@/types/types";

export default function TitleWrapper({ children, className }: PropsWithChildren<{ className?: string }>) {
  const { content } = useThemeContext();

  return (
    <Box className={cn("title-wrapper py-5 shadow-[0_1px_0_0] shadow-gray-100", className)}>
      <Box className={cn("mx-auto w-full px-4 md:px-6 lg:px-8", content === ContentType.Boxed && "max-w-340")}>
        {children}
      </Box>
    </Box>
  );
}
