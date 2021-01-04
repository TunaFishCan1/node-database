const { count } = require("console");
var express = require("express");
var router = express.Router();
const oracledb = require("oracledb");
const dbConfig = require("./dbconfig.js");
process.env.ORA_SDTZ = "KST";
let table = require("table");
let config;
async function run(url, OS, ip, acc, manu, model) {
  // get url, os and access method here
  let connection;
  try {
    let sql, binds, options, result;
    exist = 1;
    connection = await oracledb.getConnection(dbConfig);
    binds = [];
    options = {
      autoCommit: true,
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    };
    console.log("stage 0");
    sql = `SELECT TO_CHAR(SYSDATE, 'YYYYMMDDHH24MISS') AS CD FROM DUAL`;
    date0 = await connection.execute(sql, binds, options); // get access time here
    date = date0.rows[0]["CD"];
    console.log(date);
    let ts2 = Date.now();
    let date_ob2 = new Date(ts2);
    let date2 = date_ob2.getDate();
    let month2 = date_ob2.getMonth() + 1;
    let year2 = date_ob2.getFullYear();
    var initdate2 = year2.toString() + month2.toString() + date2.toString();
    if (initdate2 !== initdate) {
      initdate = initdate2;
      binds = [];
      sql_reset = `alter sequence sql.access_sequence restart start with 0`;
      await connection.execute(sql_reset, binds, options);
    }
    console.log(initdate);
    // return website code
    binds = [url];
    sql_select = `SELECT WEB_CODE as CD 
                  FROM SQL.TB_WEBSITE 
                  WHERE SQL.TB_WEBSITE.WEB_URL=:v1`;
    webcode = (await connection.execute(sql_select, binds, options)).rows[0][ // Objective #2: Website Code obtained here
      "CD"
    ];
    console.log("os transaction here");
    binds = [OS];
    sql_select = `SELECT OS_CODE AS CD 
                  FROM SQL.TB_OS 
                  WHERE SQL.TB_OS.OS_NAME=:v1`;
    oscode = (await connection.execute(sql_select, binds, options)).rows[0][ // Objective #6: OS Code obtained here
      "CD"
    ];
    console.log(oscode);
    console.log("stage 4");
    // add to IP address table

    // Need #'s 1,3,7,8
    if (acc === 0) {
      binds = [initdate, webcode, "00", oscode, date, ip];
      sql_add = `INSERT INTO TB_PORTAL_ACCESS(ACCESS_NO,WEB_CODE,METHOD_CODE,OS_CODE,ACCESS_TIME,IP_ADDR) VALUES 
                (CONCAT(:v1,TO_CHAR(SQL.ACCESS_SEQUENCE.nextval,'FM000000')),
                :v2,
                :v3,
                :v4,
                :v5,
                :v6)`;
      await connection.execute(sql_add, binds, options);
    } else {
      // Check if model is in table
      sql_count = `SELECT COUNT(*) AS CD from SQL.TB_MODEL`;
      binds = [];
      var count = (await connection.execute(sql_count, binds, options)).rows[0][
        "CD"
      ];
      binds = [model];
      if (count !== 0 && typeof count !== "undefined") {
        sql_exist = `SELECT CASE 
                      WHEN EXISTS (SELECT MODEL_NAME FROM SQL.TB_MODEL WHERE SQL.TB_MODEL.MODEL_NAME=:v1) THEN 1 
                      ELSE 0 
                      end as CD 
                    from SQL.TB_MODEL`;
        exist = (await connection.execute(sql_exist, binds, options)).rows[0][
          "CD"
        ];
      }
      // if not, add model to table:
      if (count === 0 || typeof count === "undefined" || exist === 0) {
        // Check if manufacturer is in table
        sql_count = `SELECT COUNT(*) AS CD from SQL.TB_MANU`;
        binds = [];
        count = (await connection.execute(sql_count, binds, options)).rows[0][
          "CD"
        ];
        binds = [manu];
        if (count !== 0 && typeof count !== "undefined") {
          sql_exist = `SELECT CASE 
                        WHEN EXISTS (SELECT MANU_NAME FROM SQL.TB_MANU WHERE SQL.TB_MANU.MANU_NAME=:v1) THEN 1 
                        ELSE 0 
                        end as CD 
                      from SQL.TB_MANU`;
          exist = (await connection.execute(sql_exist, binds, options)).rows[0][
            "CD"
          ];
        }
        // if manufacturer is not in table, add to table:
        if (count === 0 || typeof count === "undefined" || exist === 0) {
          sql_add = `INSERT INTO SQL.TB_MANU VALUES
                    (TO_CHAR(SQL.MANU_SEQUENCE.nextval,
                    'FM00000'),
                    :v1)`;
          await connection.execute(sql_add, binds, options);
        }
        exist = 1;
        console.log("stage 4-1");
        sql_select = `SELECT MANU_CODE AS CD 
                      FROM SQL.TB_MANU 
                      WHERE SQL.TB_MANU.MANU_NAME=:v1`;
        console.log("stage 4-2");
        manucode = (await connection.execute(sql_select, binds, options))
          .rows[0]["CD"];
        binds = [manucode, model];
        console.log("stage 4-3");
        sql_add = `INSERT INTO SQL.TB_MODEL VALUES
                  (TO_CHAR(SQL.MODEL_SEQUENCE.nextval,'FM00000'),
                  :v1,
                  :v2)`;
        console.log("stage 4-4");
        await connection.execute(sql_add, binds, options);
      }
      exist = 1;
      console.log("stage 4-5");
      binds = [manu];
      sql_select = `SELECT MANU_CODE AS CD 
                    FROM SQL.TB_MANU 
                    WHERE SQL.TB_MANU.MANU_NAME=:v1`;
      manucode = (await connection.execute(sql_select, binds, options)).rows[0][ // Objective #5: Manu code obtained
        "CD"
      ];
      console.log("stage 4-6");
      binds = [model];
      sql_select = `SELECT MODEL_CODE AS CD FROM SQL.TB_MODEL WHERE SQL.TB_MODEL.MODEL_NAME=:v1`;
      console.log("stage 4-7");
      modelcode = (await connection.execute(sql_select, binds, options))
        .rows[0]["CD"]; // Objective #4: Model Code obtained
      binds = [initdate, webcode, "01", modelcode, manucode, oscode, ip, date];
      sql_add = `INSERT INTO TB_PORTAL_ACCESS VALUES 
                (CONCAT(:v1,TO_CHAR(SQL.ACCESS_SEQUENCE.nextval,'FM000000')),
                :v2,
                :v3,
                :v4,
                :v5,
                :v6,
                :v7,
                :v8)`;
      console.log(sql_add);
      await connection.execute(sql_add, binds, options);
    }
  } catch (err) {
    console.error(err);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
}
async function query(ip, res) {
  let connection;
  try {
    let sql, binds, options;
    exist = 1;
    connection = await oracledb.getConnection(dbConfig);
    binds = [ip];
    console.log(binds);
    options = {
      autoCommit: true,
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    };
    console.log("before");
    sql_select = `SELECT * 
                  FROM SQL.TB_PORTAL_ACCESS 
                  WHERE SQL.TB_PORTAL_ACCESS.ip_addr=:v1`;
    raw = (await connection.execute(sql_select, binds, options)).rows;
    sql_count = `SELECT COUNT(*) AS CD from SQL.TB_PORTAL_ACCESS WHERE SQL.TB_PORTAL_ACCESS.ip_addr=:v1`;
    size = (await connection.execute(sql_count, binds, options)).rows[0]["CD"];
    console.log(size);
    var result = [[`접속주소`, `접속방법`, `접속시각`, `기종`, `제조사`]];

    for (var i = 0; i < size; i++) {
      row = raw[i];
      console.log(row);
      binds = [row["WEB_CODE"]];
      sql_select = `SELECT WEB_URL as CD 
                    FROM SQL.TB_WEBSITE 
                    WHERE SQL.TB_WEBSITE.WEB_CODE=:v1`;
      weburl = (await connection.execute(sql_select, binds, options)).rows[0][
        "CD"
      ];
      if (row["METHOD_CODE"] == "00") {
        meth = `PC`;
        result.push({
          addr: weburl,
          meth: meth,
          time: row["ACCESS_TIME"],
          model: ``,
          manu: ``,
        });
      } else {
        meth = `모바일`;
        binds = [row["MODEL_CODE"]];
        sql_select = `SELECT MODEL_NAME as CD 
                      FROM SQL.TB_MODEL 
                      WHERE SQL.TB_MODEL.MODEL_CODE=:v1`;
        moname = (await connection.execute(sql_select, binds, options)).rows[0][
          "CD"
        ];
        sql_select = `SELECT MANU_NAME as CD 
                      FROM SQL.TB_MANU 
                      WHERE SQL.TB_MANU.MANU_CODE=:v1`;
        maname = (await connection.execute(sql_select, binds, options)).rows[0][
          "CD"
        ];
        result.push({
          addr: weburl,
          meth: meth,
          time: row["ACCESS_TIME"],
          model: moname,
          manu: maname,
        });
      }
    }
    config = {
      // Predefined styles of table
      border: table.getBorderCharacters("ramac"),
    };
    res.json({ data: result });
  } catch (err) {
    console.error(err);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
}
let ts = Date.now();
let date_ob = new Date(ts);
let date = date_ob.getDate();
let month = date_ob.getMonth() + 1;
let year = date_ob.getFullYear();
var initdate = year.toString() + month.toString() + date.toString();

router.get("/", function (req, res) {
  res.type("application/json");
  res.send("API is working properly");
});
router.post("/", function (req, res) {
  ip = req.body.ip;
  console.log(req.body.model);
  if (req.body.access === 0) {
    run(req.body.url, req.body.OS, ip, 0, "", "");
    res.send(`Opening new tab to ${req.body.url}`);
  } else if (req.body.access === 1) {
    run(
      req.body.url,
      req.body.OS,
      ip,
      1,
      req.body.manufacturer,
      req.body.model
    );
    res.send(`Opening new tab to ${req.body.url}`);
  } else {
    sending = query(req.body.ip, res);
    //res.send(sending);
  }
});
module.exports = router;
