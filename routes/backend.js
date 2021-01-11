var express = require(`express`);
var router = express.Router();
const oracledb = require("oracledb"); // OracleDB 로그인 정보
const dbConfig = require("./dbconfig.js");
process.env.ORA_SDTZ = "KST"; // 한국 시각으로 설정
async function run(url, OS, ip, acc, manu, model) {
  // get url, os and access method here
  let connection;
  try {
    let binds, options; // 기본설정을 위한 변수를 지정한다

    connection = await oracledb.getConnection(dbConfig); // OracleDB에 접속
    binds = []; // SQL 명령어 속에 넣을 변수 리스트
    options = {
      // SQL 명령을 내릴 시 옵션
      autoCommit: true, // 자동으로 SQL에 내린 명령은 저장된다
      outFormat: oracledb.OUT_FORMAT_OBJECT, // 오브젝트 형식으로 SQL 결과가 저장됨
    };
    sql_select = `SELECT /* SELECT.DUAL.001 */
                         TO_CHAR(SYSDATE, 'YYYYMMDDHH24MISS') AS ACCESS_TIME 
                    FROM DUAL A`; // 접속 시각 구하는 SQL 명령
    date0 = await connection.execute(sql_select, binds, options); // OracleDB로 SQL 명령 보내기
    date = date0.rows[0]["ACCESS_TIME"];
    sql_change = `SELECT COUNT(*) AS CUR_DATE 
                      FROM SQL.TB_PORTAL_ACCESS 
                     WHERE SUBSTR(ACCESS_NO,1,8)=TO_CHAR(SYSDATE, 'YYYYMMDD')`;
    cdate = await connection.execute(sql_change, binds, options);
    if (cdate.rows[0]["CUR_DATE"] === 0) {
      sql_update = `ALTER
                 SEQUENCE SQL.ACCESS_SEQUENCE
                  RESTART START WITH 1`;
      await connection.execute(sql_update, binds, options);
    }
    // OracleDB로 SQL 명령 보내기
    var initdate = date.slice(0, 8);
    binds = [url]; // 바로 아래의 SQL코드의 :v1 변수 저장
    sql_select = `SELECT /* SELECT.TB_WEBSITE_001 */
                         A.WEB_CODE AS CUR_WEB_CODE 
                    FROM SQL.TB_WEBSITE A 
                   WHERE A.WEB_URL=:v1`; // 웹사이트 코드를 구하는 SQL 명령
    webcode = (await connection.execute(sql_select, binds, options)).rows[0][ // OracleDB로 명령 송/수신
      "CUR_WEB_CODE"
    ];
    binds = [OS]; // 바로 아래의 SQL코드의 :v1 변수 저장
    sql_select = `SELECT /* SELECT.TB_OS_001 */
                         A.OS_CODE AS CUR_OS_CODE 
                    FROM SQL.TB_OS A 
                   WHERE A.OS_NAME=:v1`; // OS 코드를 구하는 SQL 명령
    var untiltrue = 0;
    while (untiltrue === 0) {
      os_proto = (await connection.execute(sql_select, binds, options)).rows[0];
      if (os_proto === undefined) continue;
      untiltrue = 1;
      oscode = os_proto["CUR_OS_CODE"];
      // OracleDB로 명령 송/수신
    }
    if (acc === 0) {
      // acc=0: PC. acc=1: 모바일 acc가 0도 1도 아닐 경우: 접속기록 조회
      // ↓↓ 순서대로 날짜 (엑세스코드용), 웹사이트 코드, 접속 방법, OS 코드, 접속시각, IP주소
      binds = [initdate, webcode, "01", oscode, date, ip];
      sql_add = `INSERT /* INSERT.TB_PORTAL_ACCESS.001 */
                   INTO SQL.TB_PORTAL_ACCESS( ACCESS_NO,
                                              WEB_CODE,
                                              METHOD_CODE,
                                              OS_CODE,
                                              ACCESS_TIME,
                                              IP_ADDR
                                            ) 
                 VALUES ( CONCAT(:v1,
                          TO_CHAR(SQL.ACCESS_SEQUENCE.nextval,'FM000000')),
                          :v2,
                          :v3,
                          :v4,
                          :v5,
                          :v6
                        )`; // 접속 정보를 TB_PORTAL_ACCESS로 추가
      await connection.execute(sql_add, binds, options); // OracleDB로 명령 송/수신
    } else {
      exist = 1; // 테이블에 현재 찾는 수치가 존재하는지 판단하는 변수
      sql_count = `SELECT  /* SELECT.TB_MODEL_001 */
                          COUNT(*) AS TB_MODEL_SIZE 
                     FROM SQL.TB_MODEL A`; // 테이블의 크기 측정
      binds = [];
      var count = (await connection.execute(sql_count, binds, options)).rows[0][
        "TB_MODEL_SIZE"
      ];
      binds = [model];
      if (count !== 0 && typeof count !== "undefined") {
        // 테이블의 크기가 0이 아닐 때
        sql_exist = `SELECT /* SELECT.DUAL.SELECT.TB_MODEL.001 */ 
                            CASE WHEN COUNT(*) >= 1 
                                 THEN 1 
                                 ELSE 0 END AS IS_MODEL_NAME_EXIST
                       FROM DUAL A
                      WHERE EXISTS ( SELECT 1 
                                       FROM SQL.TB_MODEL K 
                                      WHERE K.MODEL_NAME = :V1 
                                   )`; // 기종 테이블에 모델명이 포함되어 있는지 검색
        exist = (await connection.execute(sql_exist, binds, options)).rows[0][
          "IS_MODEL_NAME_EXIST"
        ]; // OracleDB로 명령 송/수신
      }
      if (count === 0 || typeof count === "undefined" || exist === 0) {
        // 기종이 모델 테이블에 없을 경우:
        sql_count = `SELECT /* SELECT.TB_MANU.001 */
                            COUNT(*) AS TB_MANU_SIZE 
                       FROM SQL.TB_MANU A`; // 테이블의 크기 측정
        binds = [];
        count = (await connection.execute(sql_count, binds, options)).rows[0][
          "TB_MANU_SIZE"
        ]; // OracleDB로 명령 송/수신

        binds = [manu];
        if (count !== 0 && typeof count !== "undefined") {
          // 테이블의 크기가 0이 아닐 때
          sql_exist = `SELECT /* SELECT.DUAL.SELECT.TB_MANU.001 */ 
                              CASE WHEN COUNT(*) >= 1 
                                 THEN 1 
                                 ELSE 0 END AS IS_MANU_NAME_EXIST
                         FROM DUAL A
                        WHERE EXISTS ( SELECT 1 
                                         FROM SQL.TB_MANU K 
                                        WHERE K.MANU_NAME = :V1 
                                     )`; // 기종 테이블에 모델명이 포함되어 있는지 검색
          exist = (await connection.execute(sql_exist, binds, options)).rows[0][
            "IS_MANU_NAME_EXIST"
          ]; // OracleDB로 명령 송/수신
        }
        if (count === 0 || typeof count === "undefined" || exist === 0) {
          // 제조사가 테이블에 없을 시:
          sql_add = `INSERT /* INSERT.TB_MANU.001 */ 
                         INTO SQL.TB_MANU 
                       VALUES ( TO_CHAR(SQL.MANU_SEQUENCE.nextval, 'FM00000'),
                                :v1
                              )`; // 제조사 테이블에 제조사 추가
          await connection.execute(sql_add, binds, options);
        }
        exist = 1; // 변수 초기화
        sql_select = `SELECT /* SELECT.TB_MANU.002 */
                               A.MANU_CODE AS CUR_MANU_CODE 
                          FROM SQL.TB_MANU A 
                         WHERE A.MANU_NAME=:v1`; // 제조사 테이블에서 제조사 검색
        manucode = (await connection.execute(sql_select, binds, options))
          .rows[0]["CUR_MANU_CODE"];
        binds = [manucode, model];
        sql_add = `INSERT /* INSERT.TB_MODEL.001 */ 
                       INTO SQL.TB_MODEL 
                     VALUES ( TO_CHAR(SQL.MODEL_SEQUENCE.nextval,'FM00000'),
                              :v1,
                              :v2
                            )`;
        await connection.execute(sql_add, binds, options);
      }
      exist = 1; // 변수 초기화
      binds = [manu];
      sql_select = `SELECT /* SELECT.TB_MANU.003 */
                             A.MANU_CODE AS CUR_MANU_CODE 
                        FROM SQL.TB_MANU A
                       WHERE A.MANU_NAME=:v1`; // 제조사 코드 (위 if-loop를 거쳤다면 다시) 반환 명령
      manucode = (await connection.execute(sql_select, binds, options)).rows[0][
        "CUR_MANU_CODE"
      ]; // Objective #5: Manu code obtained
      binds = [model];
      sql_select = `SELECT /* SELECT.TB_MODEL_002 */
                             A.MODEL_CODE AS CUR_MODEL_CODE 
                        FROM SQL.TB_MODEL A
                       WHERE A.MODEL_NAME=:v1`; // 기종 코드 반환 명령
      modelcode = (await connection.execute(sql_select, binds, options))
        .rows[0]["CUR_MODEL_CODE"];
      binds = [initdate, webcode, "02", modelcode, manucode, oscode, ip, date];
      sql_add = `INSERT /* INSERT.TB_PORTAL_ACCESS.002 */
                     INTO TB_PORTAL_ACCESS 
                   VALUES ( CONCAT(:v1,TO_CHAR(SQL.ACCESS_SEQUENCE.nextval,'FM000000')),
                            :v2,
                            :v3,
                            :v4,
                            :v5,
                            :v6,
                            :v7,
                            :v8
                          )`; // 접속 정보를 TB_PORTAL_ACCESS로 추가
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
    let binds, options;
    exist = 1;
    connection = await oracledb.getConnection(dbConfig);
    binds = [ip];
    options = {
      autoCommit: true,
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    };
    sql_select = `SELECT /* SELECT.TB_PORTAL_ACCESS.001 */
                         * 
                    FROM SQL.TB_PORTAL_ACCESS A
                   WHERE A.IP_ADDR=:v1
                   ORDER BY A.ACCESS_NO`; // IP에서의 모든 접속 기록 정보 세기
    raw = (await connection.execute(sql_select, binds, options)).rows;
    sql_count = `SELECT /* SELECT.PORTAL_ACCESS.002 */
                        COUNT(*) AS CD 
                   FROM SQL.TB_PORTAL_ACCESS A
                  WHERE A.IP_ADDR=:v1`; // IP 에서의 접속 횟수 세기
    size = (await connection.execute(sql_count, binds, options)).rows[0]["CD"];
    var result = []; // 초기값이 프론트엔드에서 표시될 칼럼 이름
    for (var i = 0; i < size; i++) {
      // 접속 기록을 순차적으로 처리
      row = raw[i]; // 하나의 접속 기록을 뽑음
      binds = [row["WEB_CODE"]]; // 웹코드를 변수로 가짐
      sql_select = `SELECT /* SELECT.TB_WEBSITE.002 */
                           WEB_URL AS URL_INSTANCE 
                      FROM SQL.TB_WEBSITE A
                     WHERE A.WEB_CODE=:v1`; // 웹코드로 웹사이트 검색
      weburl = (await connection.execute(sql_select, binds, options)).rows[0][
        "URL_INSTANCE"
      ];
      ret_date =
        row["ACCESS_TIME"].slice(0, 4) +
        `년 ` +
        row["ACCESS_TIME"].slice(4, 6) +
        `월 ` +
        row["ACCESS_TIME"].slice(6, 8) +
        `일` +
        row["ACCESS_TIME"].slice(8, 10) +
        `시` +
        row["ACCESS_TIME"].slice(10, 12) +
        `분`;
      if (row["METHOD_CODE"] == "01") {
        meth = `PC`;
        result.push({
          addr: weburl,
          meth: meth,
          time: ret_date,
          model: ``,
          manu: ``,
        }); // 결과 배열에 항목을 추가한다
      } else {
        meth = `모바일`;
        binds = [row["MODEL_CODE"]];
        sql_select = `SELECT /* SELECT.TB_MODEL.003 */
                             A.MODEL_NAME AS MODEL_INSTANCE 
                        FROM SQL.TB_MODEL A
                       WHERE A.MODEL_CODE=:v1`;
        moname = (await connection.execute(sql_select, binds, options)).rows[0][
          "MODEL_INSTANCE"
        ];
        binds = [row["MANU_CODE"]];
        sql_select = `SELECT /* SELECT.TB_MANU.004 */
                             MANU_NAME as MANU_INSTANCE 
                        FROM SQL.TB_MANU 
                       WHERE SQL.TB_MANU.MANU_CODE=:v1`;
        maname = (await connection.execute(sql_select, binds, options)).rows[0][
          "MANU_INSTANCE"
        ];
        result.push({
          addr: weburl,
          meth: meth,
          time: ret_date,
          model: moname,
          manu: maname,
        });
      }
    }
    res.json({ data: result }); // 결과 데이터를 클라이언트로 보내기
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

router.get(`/`, function (req, res, next) {
  res.send(`정상적으로 작동중입니다`);
});

router.post("/", function (req, res) {
  ip = req.body.ip; // 클라이언트가 보낸 public ip 주소
  if (req.body.access === 0) {
    // 보낸 클라리언트가 PC일 때
    run(req.body.url, req.body.OS, ip, 0, "", "");
    res.send(`${req.body.url}을 열었습니다`);
  } else if (req.body.access === 1) {
    // 보낸 클라이언트가 모바일 기기일 때
    run(
      req.body.url, // 웹사이트 URL
      req.body.OS, // 운영체제
      ip, // ip주소
      1, // 접근 방법 (0이 PC, 1이 모바일)
      req.body.manufacturer, // 제조사
      req.body.model // 모델명
    );
    res.send(`${req.body.url}을 열었습니다`);
  } else {
    sending = query(req.body.ip, res); // 접속이력 문의를 받았을 시 응답 (나중에 추가)
  }
});

module.exports = router;
