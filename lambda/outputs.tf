output "url" {
  value = "${replace(aws_apigatewayv2_route.route.route_key, "GET ", "")}"
}