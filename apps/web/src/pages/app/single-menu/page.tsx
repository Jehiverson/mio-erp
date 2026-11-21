import { Link } from "react-router";

import { Breadcrumbs, Card, CardContent, Typography } from "@mui/material";
import { Grid } from "@mui/material";

import ContentWrapper from "@/components/layout/containers/content-wrapper";
import TitleWrapper from "@/components/layout/containers/title-wrapper";
import NiChevronRightSmall from "@/icons/nexture/ni-chevron-right-small";

export default function SingleMenu() {
  return (
    <>
      <TitleWrapper>
        <Grid container spacing={2.5} className="w-full" size={12}>
          <Grid size={12}>
            <Typography variant="h1" component="h1" className="mb-0">
              Single Menu
            </Typography>
            <Breadcrumbs separator={<NiChevronRightSmall size="small" />}>
              <Link color="inherit" to="/home/sub">
                Home
              </Link>
              <Typography variant="body2">Single Menu</Typography>
            </Breadcrumbs>
          </Grid>
        </Grid>
      </TitleWrapper>

      <ContentWrapper>
        <Grid container spacing={5} size={12}>
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
