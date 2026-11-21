import dayjs from "dayjs";

import { GridRenderEditCellParams, useGridApiContext } from "@mui/x-data-grid-pro";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

import NiCalendar from "@/icons/nexture/ni-calendar";
import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import NiChevronLeftSmall from "@/icons/nexture/ni-chevron-left-small";
import NiChevronRightSmall from "@/icons/nexture/ni-chevron-right-small";
import { cn } from "@/lib/utils";

export default function DataGridDate(props: GridRenderEditCellParams) {
  const { id, value, field } = props;
  const apiRef = useGridApiContext();
  function handleChange(newValue: any) {
    apiRef.current.setEditCellValue({ id, field, value: dayjs(newValue).toDate() });
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DatePicker
        defaultValue={value ? dayjs(value) : null}
        onChange={handleChange}
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
