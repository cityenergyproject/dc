# -*- coding: utf-8 -*-

"""
Prepares a DOEE pip delimited csv for `load_doee.sh`.
"""

import os, sys, csv, argparse

replacement_headers="pid|dc_real_pid|pm_pid|property_name|pm_parent_pid|parent_property_name|year_ending|report_status|address_of_record|owner_of_record|ward|reported_address|city|state|postal_code|year_built|primary_ptype_self|primary_ptype_epa|tax_record_floor_area|reported_gross_floor_area|energy_star_score|site_eui|weather_norm_site_eui|source_eui|weather_norm_source_eui|total_ghg_emissions|total_ghg_emissions_intensity|water_use|electricity_use|natural_gas_use|fuel_use|district_water_use|metered_areas_energy|metered_areas_water|xcoordinate|ycoordinate|ycorrected|xcorrected"

number_fields = "ward|postal_code|year_built|tax_record_floor_area|reported_gross_floor_area|energy_star_score|site_eui|weather_norm_site_eui|source_eui|weather_norm_source_eui|total_ghg_emissions|total_ghg_emissions_intensity|water_use|electricity_use|natural_gas_use|fuel_use|district_water_use|xcoordinate|ycoordinate|ycorrected|xcorrected"

def main(args):
  headers = replacement_headers.split('|')
  numbers = number_fields.split('|')

  filename = os.path.splitext(os.path.basename(args.inputfile))[0]
  outfile = open('%s_ready.csv' % filename, 'wb')
  writer = csv.writer(outfile, delimiter='|', quotechar='"', quoting=csv.QUOTE_MINIMAL, lineterminator=os.linesep)

  writer.writerow(headers)
  with open(args.inputfile, 'r') as f:
    rows = csv.reader(f, delimiter='|')

    # skip header row
    rows.next()

    for row in rows:
      out = []
      for i, val in enumerate(row):
        try:
          field = headers[i]
        except IndexError:
          field = None

        if field:
          val = val.strip()

          if '\n' in val:
            val = val.replace('\n', ' ')

          if '\r' in val:
            val = val.replace('\r', ' ')

          if field in numbers:
            val = val.replace(',', '')
            if not val.lstrip('-').replace('.','',1).isdigit():
              val = ''


          out.append(val)



      writer.writerow(out)


  outfile.close()

if __name__ == "__main__":
  parser = argparse.ArgumentParser(description='Prepares a DOEE pip delimited CSV for `load_doee.sh`')
  parser.add_argument('-i', '--inputfile', help='CSV file to transform', required=True)

  args = parser.parse_args()
  main(args)
