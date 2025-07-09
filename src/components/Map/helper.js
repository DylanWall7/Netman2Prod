import data from "./data";
import devicedata from "./devicedata";
import React from "react";

export default function helper() {
  const location = [data];
  const device = [devicedata];

  const array3 = location.concat(device);

  console.log(array3);
}
