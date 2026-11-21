import { useEffect } from "react";
import { useNavigate } from "react-router";

import { LINKS } from "@/constants";

export default function Auth() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(LINKS.home);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div>Home!</div>;
}
