import React from "react";
import { useParams, Link } from "react-router-dom";
// import { PROVISIONDATA } from "./data";
import Layout from "./Layout";

export const MistAssignSiteProv = ({ siteList }) => {
  const { siteCode } = useParams();

  const sites = siteList.find((sites) => sites.name === siteCode);

  // const site = siteList.map((site) => site.name === siteCode);

  console.log(sites);
  return (
    <div>
      <Layout site={sites} />

      <Link className="ml-10" to="/mistassigntool">
        Back to Provisioning
      </Link>
    </div>
  );
};
