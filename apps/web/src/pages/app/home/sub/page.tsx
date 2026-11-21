import { Link } from "react-router";

import { Breadcrumbs, Button, Card, CardContent, Grid, Tooltip, Typography } from "@mui/material";

import ContentWrapper from "@/components/layout/containers/content-wrapper";
import TitleWrapper from "@/components/layout/containers/title-wrapper";
import NiCellsPlus from "@/icons/nexture/ni-cells-plus";
import NiChevronRightSmall from "@/icons/nexture/ni-chevron-right-small";
import NiKnobs from "@/icons/nexture/ni-knobs";

export default function Page() {
  return (
    <>
      <TitleWrapper>
        <Grid container spacing={2.5} className="w-full" size={12}>
          <Grid size={{ xs: 12, md: "grow" }}>
            <Typography variant="h1" component="h1" className="mb-0">
              Home
            </Typography>
            <Breadcrumbs separator={<NiChevronRightSmall size="small" />}>
              <Link color="inherit" to="/home">
                Home
              </Link>
              <Typography variant="body2">Sub</Typography>
            </Breadcrumbs>
          </Grid>

          <Grid size={{ xs: 12, md: "auto" }} className="flex flex-row items-start gap-2">
            <Tooltip title="Configuration">
              <Button
                className="icon-only surface-standard flex-none"
                size="medium"
                color="grey"
                variant="surface"
                startIcon={<NiKnobs size={"medium"} />}
              />
            </Tooltip>
            <Tooltip title="Add Widget">
              <Button
                className="icon-only surface-standard flex-none"
                size="medium"
                color="grey"
                variant="surface"
                startIcon={<NiCellsPlus size={"medium"} />}
              />
            </Tooltip>
          </Grid>
        </Grid>
      </TitleWrapper>

      <ContentWrapper>
        <Grid container size={12} spacing={5}>
          <Grid size={{ lg: 8, xs: 12 }}>
            <Card>
              <Typography variant="h6" component="h6" className="card-title px-4 pt-4">
                Empty Card
              </Typography>
              <CardContent></CardContent>
            </Card>
          </Grid>

          <Grid size={{ lg: 4, xs: 12 }}>
            <Card>
              <Typography variant="h6" component="h6" className="card-title px-4 pt-4">
                Empty Card
              </Typography>
              <CardContent></CardContent>
            </Card>
          </Grid>
        </Grid>
      </ContentWrapper>
    </>
  );
}
