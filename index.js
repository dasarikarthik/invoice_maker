const agencies_data=require("./public/agencies_data.json")
const { ToWords } = require("to-words");
const express = require("express");
const app = express();
const path = require("path");
const router = express.Router();
const bodyParser = require("body-parser");
const handlebars = require('handlebars');
const puppeteer = require("puppeteer");
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
let page;
const getPage = async () => {
  if (page) return page;
  const browser = await puppeteer.launch({ headless: true,args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  page = await browser.newPage();
  return page;
};

router.get("/", function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'invoice.html'));
});
router.post("/genrate_invoice", async function (req, res) {
  const data = req.body;
  const total_cost = data.quantity * data.rate;
  const tax = data.tax;
  const tax_applied = (total_cost * tax) / 100; 
  const total_amount = Math.round((total_cost + tax_applied) * 100) / 100;
  const toWords = new ToWords();
  let words = toWords.convert(total_amount, { currency: true });
  data["words"] = words;
  data["total_amount"] = total_amount;
  data["tax_applied"] = tax_applied;
  data["total_cost"] = total_cost;
  data["from_enterprise"]=agencies_data[data.from_enterprise]
  data["to_enterprise"]=agencies_data[data.to_enterprise]
  const fs = require("fs");
  var htmlTemplate = fs.readFileSync("./public/invoice_template.html").toString();
  var cssStyles = fs.readFileSync("./public/invoice_template.css").toString();
  var templateData = {
    htmlTemplate: htmlTemplate,
    cssStyles: cssStyles,
  };
  var processed_data = {};
  processed_data["templateData"] = templateData;
  processed_data["jsonData"] = data;
  var generated_pdf =await generate_pdf(processed_data);
  res.send(generated_pdf.toString());
});

async function generate_pdf(data) {
  const jsonData = data;
  const htmlTemplate = jsonData.templateData.htmlTemplate;

  const template = handlebars.compile(htmlTemplate);
  const compiledHtml = template(jsonData.jsonData);

  const page = await getPage();

  await page.setContent(compiledHtml);

  const css = jsonData.templateData.cssStyles;

  await page.addStyleTag({ content: css });

  const pdfBuffer = await page.pdf({
    format: jsonData.jsonData.format == "custom" ? "" : "A4",
    width: jsonData.jsonData.format == "custom" ? jsonData.jsonData.width : "",
    height:
      jsonData.jsonData.format == "custom" ? jsonData.jsonData.height : "",
    printBackground: true,
  });

  const pdfBase64 = pdfBuffer.toString("base64");
  return pdfBase64;
}



app.use("/", router);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
