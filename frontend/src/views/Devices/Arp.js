import React, { useContext } from 'react'
import { Component } from "react";
import ZoneListing from "components/Zones/ZoneListing.js"
import { getArp, getDevices, getNFVerdictMap } from "components/Helpers/Api.js";
import {APIErrorContext} from 'layouts/Admin.js';

// reactstrap components
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  CardTitle,
  Label,
  FormGroup,
  Input,
  Table,
  Row,
  Col,
  UncontrolledTooltip,
} from "reactstrap";


export default class Dhcp extends Component {


    state = { arpRows: [] };

    static contextType = APIErrorContext;

    async componentDidMount() {

      const setState = (v) => {
        this.setState(v)
      }

      let translateFlags = (number) => {
        number = parseInt(number, 16)
        let translation = ""
        if ((number & 0x2) == 0x2) {
          translation += " C"
        }

        if ((number & 0x4) == 4) {
          translation += " PERM"
        }

        translation += " (" +number + ")"

        return translation
      }

      async function refreshArp() {
        let divs = []

        const arp = await getArp().catch(error => {
          this.context.reportError("API Failure getArp: " + error.message)
        })

        for (const entry of arp) {
          const generatedID = Math.random().toString(36).substr(2, 9);

          divs.push(
            <tr key={generatedID}>
              <td className=""> { entry.IP} </td>
              <td className=""> { entry.Mac }</td>
              <td className=""> { translateFlags(entry.Flags) } </td>
              <td className=""> { entry.Device } </td>
            </tr>
          )
        }
        setState({arpRows: divs })

      }


      const notifyChange = () => {
        refreshArp()
      }

      refreshArp = refreshArp.bind(this)
      refreshArp()

    }

    render() {

      return (
        <div className="content">
          <Row>
            <Col md="12">
              <Card>
                <CardHeader>
                  <CardTitle tag="h4">ARP Table</CardTitle>
                </CardHeader>
                <CardBody>
                  <Table responsive>
                    <thead className="text-primary">
                      <tr>
                        <th>IP Address</th>
                        <th>MAC Address</th>
                        <th>Flags</th>
                        <th>Interface</th>
                      </tr>
                    </thead>
                    <tbody>
                      {this.state.arpRows}
                    </tbody>
                  </Table>
                </CardBody>
              </Card>
            </Col>
          </Row>
        </div>
      );

    }
}