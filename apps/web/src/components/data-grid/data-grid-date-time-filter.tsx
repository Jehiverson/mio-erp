import dayjs from "dayjs";

import { GridFilterInputValueProps } from "@mui/x-data-grid-pro";
import { DateTimePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

import NiCalendar from "@/icons/nexture/ni-calendar";
import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import NiChevronLeftSmall from "@/icons/nexture/ni-chevron-left-small";
import NiChevronRightSmall from "@/icons/nexture/ni-chevron-right-small";
import { cn } from "@/lib/utils";

export default function DataGridDateTimeFilter(props: GridFilterInputValueProps) {
  const { item, applyValue, apiRef } = props;

  const handleChange = (newValue: unknown) => {
    applyValue({ ...item, value: newValue });
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DateTimePicker
        defaultValue={item.value ? dayjs(item.value) : null}
        onChange={handleChange}
        label={apiRef.current.getLocaleText("filterPanelInputLabel")}
        className="outlined edit-date mb-0"
        slots={{
          openPickerIcon: (props) => {
            return <NiCalendar className={cn(props.className, "text-text-secondary")} />;
          },
          switchViewIcon: (props) => {
            return <NiChevronDownSmall className={cn(props.className, "text-text-secondary")} />;
          },
          leftArrowIcon: (props) => {
            return <NiChevronLeftSmall className={cn(props.className, "text-text-secondary")} />;
          },
          rightArrowIcon: (props) => {
            return <NiChevronRightSmall className={cn(props.className, "text-text-secondary")} />;
          },
        }}
        slotProps={{
          textField: { size: "small", variant: "standard" },
          desktopPaper: { className: "outlined" },
        }}
      />
    </LocalizationProvider>
  );
}
